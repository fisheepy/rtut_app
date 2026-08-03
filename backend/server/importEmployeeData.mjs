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
        if (results.errors.length > 0) {
            throw new Error(`CSV parsing failed: ${results.errors[0].message}`);
        }

        let importSummary;
        try {
            importSummary = await importEmployeesData(employees);
        } catch (error) {
            console.error('Error importing employee records:', error.message);
            throw error;
        }

        try {
            await updateEmployeesToNovuSubscribers(employees);
        } catch (error) {
            // Employee field updates should not be reported as failed only because
            // the optional notification subscriber sync could not be completed.
            console.warn('Employee records imported, but Novu sync failed:', error.message);
        }

        console.log(`IMPORT_RESULT:${JSON.stringify(importSummary)}`);
        return importSummary;
    } catch (error) {
        console.error('Error importing employees:', error.message);
        throw error;
    }
};

if (process.argv.length < 3) {
    console.error('Usage: node importEmployeeData.mjs <filePath>');
    process.exit(1);
}

// Extract command-line arguments
const filePath = process.argv[2];

// Call the function and return a non-zero exit code when database work fails.
importEmployees(filePath).catch(() => {
    process.exitCode = 1;
});

