import { addDocument } from './mongodbUtilities.mjs';
import fs from 'fs';

const addEmployee = async (tempFilePath) => {
    try {
        const newEmployeeJSON = fs.readFileSync(tempFilePath, 'utf-8');

        const newEmployee = JSON.parse(newEmployeeJSON);
        console.log(newEmployee);
        const document = {
            "First Name": newEmployee.firstName,
            "Last Name": newEmployee.lastName,
            "Hire Date": newEmployee.hireDate,
            "Position Status": 'Active',
            "Termination Date": '',
            "Home Department": newEmployee.homeDepartment,
            "Job Title": newEmployee.jobTitle,
            "Location": newEmployee.location,
            "Supervisor First Name": newEmployee.supervisorFirstName,
            "Supervisor Last Name": newEmployee.supervisorLastName,
            // Add any other fields necessary for your employee document
        };
        const result = await addDocument('employees', document);

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