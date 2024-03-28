import fs from 'fs';
import crypto from 'crypto';
import { sendNovuNotification } from './novuUtilities.mjs';
import { saveNotificationToDatabase } from './mongodbUtilities.mjs';

const currentDataTime = Date.now();

// Function to generate a unique ID based on name information
function generateUniqueId(firstName, lastName) {
    // Concatenate first name and last name to form a single string
    const nameString = `${firstName}${lastName}`;

    // Use SHA-256 hashing algorithm to generate a unique hash value
    const hash = crypto.createHash('sha256');
    hash.update(nameString);
    return hash.digest('hex');
}

// Function to split PayrollName and format filteredValues
const transformFilteredValues = (filteredValues) => {
    return filteredValues.map(({ 'Payroll Name': PayrollName, Email, Phone }) => {
        // Split PayrollName into firstName and lastName
        const [lastName, firstName] = PayrollName.split(',').map(name => name.trim());

        // Construct the object with formatted data
        const formattedData = {
            subscriberId: generateUniqueId(
                firstName.toUpperCase(),
                lastName.toUpperCase()
            ),
            firstName: firstName,
            lastName: lastName
        };

        if (Email) {
            formattedData.email = Email;
        }

        if (Phone) {
            formattedData.phone = Phone;
        }

        return formattedData;
    });
};

// Function to send notifications
const sendNotifications = async (messageContent, subject, sender, filePath, sendOptions) => {
    // Read the contents of the temporary file
    const selectedEmployeesJSON = fs.readFileSync(filePath, 'utf-8');

    try {
        // Parse the JSON string into an array of objects
        const selectedEmployees = JSON.parse(selectedEmployeesJSON);

        // Transform and format filteredValues
        const formattedValues = transformFilteredValues(selectedEmployees);

        try {
            // Use the extracted Novu operation
            await sendNovuNotification(formattedValues, messageContent, subject, sender, sendOptions);
            // Use the extracted MongoDB operation
            await saveNotificationToDatabase(sender, subject, messageContent);
        } catch (error) {
            console.error('Error:', error.message);
        }
    } catch (error) {
        console.error('Error parsing selectedEmployeesJSON:', error.message);
    }
};

// Check if command-line arguments are provided
if (process.argv.length < 9) {
    console.error('Usage: node sendNotification.mjs <messageContent> <subject> <sender> <filePath>');
    process.exit(1);
}

// Extract command-line arguments
const messageContent = process.argv[2];
const subject = process.argv[3];
const sender = process.argv[4];
const filePath = process.argv[5];
const sendOptions = {
    app: process.argv[6],
    sms: process.argv[7],
    email: process.argv[8],
}

// Call the function to send notifications
sendNotifications(messageContent, subject, sender, filePath, sendOptions);
