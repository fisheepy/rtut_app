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

const deleteEmployee = async (firstName, lastName) => {
    const client = new MongoClient(MONGODB_URI);

    try {
        const normalizedFirstName = normalizeNameInput(firstName);
        const normalizedLastName = normalizeNameInput(lastName);

        if (!normalizedFirstName || !normalizedLastName) {
            throw new Error('Error during operation: First Name and Last Name are required.');
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
        const result = await collection.deleteOne({ _id: employeeToDelete._id });

        if (result.deletedCount === 0) {
            throw new Error('Error during operation: Employee not found.');
        }

        console.log(`${result.deletedCount} document(s) deleted`);
        return result;
    } catch (error) {
        console.error('Error during operation:', error.message);
        throw error;
    } finally {
        await client.close();
        console.log('Connection to MongoDB closed');
    }
};

if (process.argv.length < 4) {
    console.error('Usage: node deleteEmployee.mjs <firstName> <lastName>');
    process.exit(1);
}

const firstName = process.argv[2];
const lastName = process.argv[3];

deleteEmployee(firstName, lastName)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
