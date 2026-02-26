import { deleteDocument } from './mongodbUtilities.mjs';

const normalizeNameInput = (value = '') => value
    .replace(/\u3000/g, ' ') // convert full-width spaces
    .trim()
    .replace(/\s+/g, ' ');

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildTolerantNameRegex = (value) => {
    const normalized = normalizeNameInput(value);
    if (!normalized) {
        return null;
    }

    const pattern = normalized
        .split(' ')
        .map(part => escapeRegExp(part))
        .join('\\s+');

    return new RegExp(`^\\s*${pattern}\\s*$`, 'i');
};

const deleteEmployee = async (firstName, lastName) => {
    try {
        const firstNameRegex = buildTolerantNameRegex(firstName);
        const lastNameRegex = buildTolerantNameRegex(lastName);

        if (!firstNameRegex || !lastNameRegex) {
            throw new Error('Error during operation: First Name and Last Name are required.');
        }

        const filter = {
            "First Name": { $regex: firstNameRegex },
            "Last Name": { $regex: lastNameRegex }
        };
        const result = await deleteDocument('employees', filter);
        
        if (result.deletedCount === 0) {
            throw new Error('Error during operation: Employee not found.');
        }
        
        console.log(`${result.deletedCount} document(s) deleted`);
        return result;
    } catch (error) {
        console.error('Error during operation:', error.message);
        throw error; // Rethrow the error to be caught by the caller
    } finally {
        console.log('Connection to MongoDB closed');
    }
}

// Check if command-line arguments are provided
if (process.argv.length < 4) {
    console.error('Usage: node deleteEmployee.mjs <firstName> <lastName>');
    process.exit(1);
}

// Extract command-line arguments
const firstName = process.argv[2];
const lastName = process.argv[3];

// Call the function to delete the employee
deleteEmployee(firstName, lastName)
    .then(() => process.exit(0)) // Exit with a zero code to indicate success
    .catch((error) => {
        console.error(error.message); // Print the error message
        process.exit(1); // Exit with a non-zero code to indicate failure
    });
