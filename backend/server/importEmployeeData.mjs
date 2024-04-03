import { importEmployeesData } from './mongodbUtilities.mjs';
import { updateEmployeesToNovuSubscribers } from './novuUtilities.mjs';
import fs from 'fs';

const importEmployees = async (filePath) => {
    const employeesJSON = fs.readFileSync(filePath, 'utf-8');

    try {
        // Parse the JSON string into an array of objects
        const employees = JSON.parse(employeesJSON);

        try {
            // Use the extracted Novu operation
            await importEmployeesData(employees);
            await updateEmployeesToNovuSubscribers(employees);
        } catch (error) {
            console.error('Error:', error.message);
        }
    } catch (error) {
        console.error('Error importing employees:', error.message);
    }
}

if (process.argv.length < 3) {
    console.error('Usage: node importEmployeeData.mjs <filePath>');
    process.exit(1);
}

// Extract command-line arguments
const filePath = process.argv[2];

// Call the function to send notifications
importEmployees(filePath);
