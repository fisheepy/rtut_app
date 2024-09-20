import { saveEventToDatabase } from './mongodbUtilities.mjs';
import fs from 'fs';

// Function to send notifications
const sendEvent = async (eventData) => {
    try {
        // Save the event to the database
        await saveEventToDatabase(eventData);
    } catch (error) {
        console.error('Error sending Event:', error.message);
    }
};

// Check if command-line arguments are provided
if (process.argv.length < 10) {
    console.error('Not enough inputs');
    process.exit(1);
}

// Extract command-line arguments
const creator = process.argv[2];
const endDate = process.argv[3];
const location = process.argv[4];
const startDate = process.argv[5];
const title = process.argv[6];
const allDay = process.argv[7];
const detail = process.argv[8];
const filePath = process.argv[9];

// Read the file and parse selected employees
const tempFilePath = fs.readFileSync(filePath, 'utf-8');
const selectedEmployees = JSON.parse(tempFilePath);

// Extract only the desired fields from selectedEmployees
const filteredEmployees = selectedEmployees.map(employee => {
    return {
        username: employee.username,       // Assuming 'name' is a field in each employee object
        firstName: employee['First Name'],     // Assuming 'email' is a field in each employee object
        lastName: employee['Last Name'] // Add other necessary fields as needed
    };
});

// Combine the event data with the filtered employees data
const eventData = {
    creator,
    endDate,
    location,
    startDate,
    title,
    allDay,
    detail,
    employees: filteredEmployees  // Add filtered employees to eventData
};

// Send the event data
sendEvent(eventData);
