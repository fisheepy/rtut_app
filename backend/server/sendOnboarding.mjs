import fs from 'fs';
import crypto from 'crypto';
import { sendNovuNotification } from './novuUtilities.mjs';
import { saveNotificationToDatabase } from './mongodbUtilities.mjs';

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
    return filteredValues.map(({
        'First Name': firstName,
        'Last Name': lastName,
        'username': username,
        'password': password,
     }) => {
        // Construct the object with formatted data
        const formattedData = {
            subscriberId: generateUniqueId(
                firstName.toUpperCase(),
                lastName.toUpperCase()
            ),
            firstName: firstName,
            lastName: lastName,
            username: username,
            password: password,
            Email: '',
            Phone: '',

        };
        return formattedData;
    });
};

// Function to send notifications
const sendOnboarding = async (filePath, sendOptions) => {
    // Read the contents of the temporary file
    const selectedEmployeesJSON = fs.readFileSync(filePath, 'utf-8');

    try {
        // Parse the JSON string into an array of objects
        const selectedEmployees = JSON.parse(selectedEmployeesJSON);

        // Transform and format filteredValues
        const formattedValues = transformFilteredValues(selectedEmployees);

        // Iterate through each formatted employee and send notification
        for (const employee of formattedValues) {
            const messageType = 'NOTIFICATION';
            const subject = 'Onboarding';
            const sender = 'RTUT App Admin';
            const messageContent = 'Hello ' + employee.firstName + ', '
                + 'You are invited to use the company App. '
                + 'You can download it from https://apps.apple.com/app/rtut/id6547833065. '
                + 'Your username is: ' + employee.username + '. Default password is: ' + employee.password + '.';

            try {
                const response = await sendNovuNotification(
                    employee, 
                    messageContent, 
                    messageType, 
                    subject, 
                    sender, 
                    sendOptions
                );

                if (response.success) {
                    console.log('Message sent successfully:', response.messageId, response.transactionId);
                    await saveNotificationToDatabase(sender, subject, messageContent, response.messageId, response.transactionId);
                }
            } catch (error) {
                console.error('Failed to send message:', error);
            }
        }
    } catch (error) {
        console.error('Error parsing selectedEmployeesJSON:', error.message);
    }
};

// Check if command-line arguments are provided
if (process.argv.length < 3) {
    console.error('Usage: node sendNotification.mjs <filePath>');
    process.exit(1);
}

// Extract command-line arguments
const filePath = process.argv[2];
const sendOptions = {
    app: 'false',
    sms: 'true',
    email: 'false',
}

// Call the function to send notifications
sendOnboarding(filePath, sendOptions);
