import fs from 'fs';
import { addNewEmployee } from './mongodbUtilities.mjs';

// Function to format the phone number
const formatPhoneNumber = (phoneNumber) => {
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return `(${match[1]})-${match[2]}-${match[3]}`;
    }
    return null;
};

// Function to validate email format
const validateEmail = (email) => {
    // Allow empty email, but validate if it's not empty
    if (!email) {
        return true; // Return true for empty emails
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Function to add an employee from a JSON file
const addEmployee = async (tempFilePath) => {
    try {
        const newEmployeeJSON = fs.readFileSync(tempFilePath, 'utf-8');
        const newEmployee = JSON.parse(newEmployeeJSON);

        // Format and validate the phone number
        newEmployee.phone = formatPhoneNumber(newEmployee.phone);
        if (!newEmployee.phone) {
            throw new Error('Error during operation: Invalid phone number format');
        }

        // Validate the email format only if email is provided
        if (!validateEmail(newEmployee.email)) {
            throw new Error('Error during operation: Invalid email format');
        }

        console.log('Formatted new employee data:', newEmployee);

        // Add the new employee to the database
        const result = await addNewEmployee(newEmployee);
        console.log(`Document inserted with ID: ${result.insertedId}`);
        return result;
    } catch (error) {
        console.error(error.message);  // Only print the message
        process.exit(1); // Exit with a non-zero code to indicate failure
    } finally {
        console.log('Operation completed.');
    }
}

// Main execution
const [tempFilePath] = process.argv.slice(2);

if (!tempFilePath) {
    console.error('Usage: node addEmployee.mjs <tempFilePath>');
    process.exit(1); // Exit with a non-zero code if no file path is provided
}

addEmployee(tempFilePath)
    .then(() => process.exit(0)) // Exit with a zero code to indicate success
    .catch((error) => {
        console.error(error.message);  // Only print the message
        process.exit(1); // Exit with a non-zero code to indicate failure
    });
