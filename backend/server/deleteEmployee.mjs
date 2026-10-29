import { MongoClient } from 'mongodb';

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;
const MONGODB_URI = `mongodb+srv://${username}:${password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;

const normalizeNameInput = (value = '') => value
    .replace(/\u3000/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildCandidateRegex = (normalizedValue) => {
    if (!normalizedValue) {
        return null;
    }

    const pattern = normalizedValue
        .split(' ')
        .map((part) => escapeRegExp(part))
        .join('\\s+');

    return new RegExp(`^\\s*${pattern}\\s*$`, 'i');
};

const validDate = (value = '') => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const dateOnly = (value) => {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
};

const deleteEmployee = async (firstName, lastName, terminationDate, terminationType, newManagerFirstName = '', newManagerLastName = '') => {
    const client = new MongoClient(MONGODB_URI);

    try {
        const normalizedFirstName = normalizeNameInput(firstName);
        const normalizedLastName = normalizeNameInput(lastName);

        if (!normalizedFirstName || !normalizedLastName || !validDate(terminationDate) || !['Voluntary', 'Involuntary'].includes(terminationType)) {
            throw new Error('Error during operation: Employee, a valid Termination Date, and a Voluntary or Involuntary Termination Type are required.');
        }

        await client.connect();
        const db = client.db(database_name);
        const collection = db.collection('employees');

        const candidateFilter = {
            'First Name': { $regex: buildCandidateRegex(normalizedFirstName) },
            'Last Name': { $regex: buildCandidateRegex(normalizedLastName) },
        };

        const candidates = await collection.find(candidateFilter).toArray();
        const exactNormalizedMatches = candidates.filter((employee) => {
            const employeeFirstName = normalizeNameInput(employee['First Name']);
            const employeeLastName = normalizeNameInput(employee['Last Name']);
            return employeeFirstName === normalizedFirstName && employeeLastName === normalizedLastName;
        });

        if (exactNormalizedMatches.length === 0) {
            throw new Error('Error during operation: Employee not found.');
        }

        if (exactNormalizedMatches.length > 1) {
            throw new Error(`Error during operation: Multiple employees matched (${exactNormalizedMatches.length}). Please provide a more specific identifier (e.g. email or phone).`);
        }

        const [employeeToDelete] = exactNormalizedMatches;
        const hireDate = dateOnly(employeeToDelete['Hire Date']);
        if (hireDate && terminationDate < hireDate) {
            throw new Error(`Error during operation: Termination Date cannot be before Hire Date (${hireDate}).`);
        }
        const directReportFilter = {
            'Supervisor First Name': { $regex: buildCandidateRegex(normalizeNameInput(employeeToDelete['First Name'])) },
            'Supervisor Last Name': { $regex: buildCandidateRegex(normalizeNameInput(employeeToDelete['Last Name'])) },
            'Account Active': 'Active',
            _id: { $ne: employeeToDelete._id },
        };
        const directReportCount = await collection.countDocuments(directReportFilter);
        let replacementManager = null;
        if (directReportCount > 0) {
            const normalizedManagerFirst = normalizeNameInput(newManagerFirstName);
            const normalizedManagerLast = normalizeNameInput(newManagerLastName);
            if (!normalizedManagerFirst || !normalizedManagerLast) {
                throw new Error(`Error during operation: This employee manages ${directReportCount} active employee(s). A new manager is required.`);
            }
            replacementManager = await collection.findOne({
                'First Name': { $regex: buildCandidateRegex(normalizedManagerFirst) },
                'Last Name': { $regex: buildCandidateRegex(normalizedManagerLast) },
                'Account Active': 'Active',
                _id: { $ne: employeeToDelete._id },
            });
            if (!replacementManager) throw new Error('Error during operation: The selected replacement manager is not an active employee.');
        }

        let result;
        const session = client.startSession();
        try {
            await session.withTransaction(async () => {
                if (replacementManager) {
                    await collection.updateMany(directReportFilter, { $set: {
                        'Supervisor First Name': replacementManager['First Name'],
                        'Supervisor Last Name': replacementManager['Last Name'],
                        'Supervisor Reassigned Date': new Date(),
                    } }, { session });
                }
                result = await collection.updateOne(
                    { _id: employeeToDelete._id },
                    { $set: {
                        'Termination Date': terminationDate,
                        'Termination Type': terminationType,
                        'Position Status': 'Terminated',
                        'Account Active': 'Inactive',
                        'HR Platform Termination At': new Date(),
                        'Termination Replacement Manager First Name': replacementManager?.['First Name'] || '',
                        'Termination Replacement Manager Last Name': replacementManager?.['Last Name'] || '',
                        'Termination Reassigned Direct Reports': directReportCount,
                    } },
                    { session },
                );
            });
        } finally {
            await session.endSession();
        }

        if (result.matchedCount === 0) {
            throw new Error('Error during operation: Employee not found.');
        }

        console.log(`Employee archived as ${terminationType.toLowerCase()} termination effective ${terminationDate}.`);
        console.log(`TERMINATION_RESULT:${JSON.stringify({ success: true, terminationDate, terminationType, reassignedDirectReports: directReportCount, replacementManager: replacementManager ? `${replacementManager['First Name']} ${replacementManager['Last Name']}` : null })}`);
        return result;
    } catch (error) {
        console.error('Error during operation:', error.message);
        throw error;
    } finally {
        await client.close();
        console.log('Connection to MongoDB closed');
    }
};

if (process.argv.length < 6) {
    console.error('Usage: node deleteEmployee.mjs <firstName> <lastName> <terminationDate> <terminationType> [newManagerFirstName] [newManagerLastName]');
    process.exit(1);
}

const firstName = process.argv[2];
const lastName = process.argv[3];
const terminationDate = process.argv[4];
const terminationType = process.argv[5] || '';
const newManagerFirstName = process.argv[6] || '';
const newManagerLastName = process.argv[7] || '';

deleteEmployee(firstName, lastName, terminationDate, terminationType, newManagerFirstName, newManagerLastName)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
