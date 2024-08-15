import fs from 'fs';
import { addNewEmployee } from './mongodbUtilities.mjs';

// Function to add an employee from a JSON file
const addEmployee = async (tempFilePath) => {
    try {
        const newEmployeeJSON = fs.readFileSync(tempFilePath, 'utf-8');
        const newEmployee = JSON.parse(newEmployeeJSON);
        console.log(newEmployee);

        const result = await addNewEmployee(newEmployee);
        console.log(`Document inserted with ID: ${result.insertedId}`);
        return result;
    } catch (error) {
        console.error('Error during MongoDB operation:', error);
        throw error;
    } finally {
        console.log('Connection to MongoDB closed');
    }
}

// Example usage:
if (process.argv.length < 3) {
    console.error('Usage: node addEmployee.mjs <tempFilePath>');
    process.exit(1);
}

const [tempFilePath] = process.argv.slice(2);

// Call the function to add an employee
addEmployee(tempFilePath);
