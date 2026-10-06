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

const deleteEmployee = async (firstName, lastName, terminationDate) => {
    const client = new MongoClient(MONGODB_URI);

    try {
        const normalizedFirstName = normalizeNameInput(firstName);
        const normalizedLastName = normalizeNameInput(lastName);

        if (!normalizedFirstName || !normalizedLastName || !validDate(terminationDate)) {
            throw new Error('Error during operation: First Name, Last Name, and a valid Termination Date are required.');
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
        const result = await collection.updateOne(
            { _id: employeeToDelete._id },
            {
                $set: {
                    'Termination Date': terminationDate,
                    'Position Status': 'Terminated',
                    'Account Active': 'Inactive',
                    'HR Platform Termination At': new Date(),
                },
            },
        );

        if (result.matchedCount === 0) {
            throw new Error('Error during operation: Employee not found.');
        }

        console.log(`Employee archived as terminated effective ${terminationDate}.`);
        return result;
    } catch (error) {
        console.error('Error during operation:', error.message);
        throw error;
    } finally {
        await client.close();
        console.log('Connection to MongoDB closed');
    }
};

if (process.argv.length < 5) {
    console.error('Usage: node deleteEmployee.mjs <firstName> <lastName> <terminationDate>');
    process.exit(1);
}

const firstName = process.argv[2];
const lastName = process.argv[3];
const terminationDate = process.argv[4];

deleteEmployee(firstName, lastName, terminationDate)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
