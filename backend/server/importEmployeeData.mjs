import fs from 'fs';
import Papa from 'papaparse'; // Importing as default
import { importEmployeesData } from './mongodbUtilities.mjs';
import { updateEmployeesToNovuSubscribers } from './novuUtilities.mjs';

const importEmployees = async (filePath) => {
    const employeesCSV = fs.readFileSync(filePath, 'utf-8');

    try {
        // Parse the CSV string into an array of objects
        const results = Papa.parse(employeesCSV, {
            header: true,
            skipEmptyLines: true,
        });

        const employees = results.data; // This gives you an array of employee objects

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
};

if (process.argv.length < 3) {
    console.error('Usage: node importEmployeeData.mjs <filePath>');
    process.exit(1);
}

// Extract command-line arguments
const filePath = process.argv[2];

// Call the function to import employees
importEmployees(filePath);
