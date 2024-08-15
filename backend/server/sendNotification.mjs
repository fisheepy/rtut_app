import fs from 'fs';
import { sendNovuNotification, generateUniqueId } from './novuUtilities.mjs';
import { saveNotificationToDatabase } from './mongodbUtilities.mjs';

// Function to split PayrollName and format filteredValues
const transformFilteredValues = (filteredValues) => {
    return filteredValues.map(({
        'First Name': firstName,
        'Last Name': lastName,
        'Email': email,
        'Phone': phone }) => {
        // Split PayrollName into firstName and lastName

        // Construct the object with formatted data
        const formattedData = {
            subscriberId: generateUniqueId(
                firstName.toUpperCase(),
                lastName.toUpperCase()
            ),
            firstName: firstName,
            lastName: lastName
        };

        if (email) {
            formattedData.Email = email;
        }

        if (phone) {
            formattedData.Phone = phone;
        }

        return formattedData;
    });
};

// Function to send notifications
const sendNotifications = async (messageContent, subject, sender, filePath, sendOptions) => {
    // Read the contents of the temporary file
    const selectedEmployeesJSON = fs.readFileSync(filePath, 'utf-8');
    const messageContent = JSON.parse(fs.readFileSync(messageContentPath)).messageContent;

    try {
        // Parse the JSON string into an array of objects
        const selectedEmployees = JSON.parse(selectedEmployeesJSON);

        // Transform and format filteredValues
        const formattedValues = transformFilteredValues(selectedEmployees);

        try {
            const messageType = 'NOTIFICATION';
            // Use the extracted Novu operation
            await sendNovuNotification(formattedValues, messageContent, messageType, subject, sender, sendOptions)
                .then(response => {
                    if (response.success) {
                        console.log('Message sent successfully:', response.messageId, response.transactionId);
                        // Use the extracted MongoDB operation
                        saveNotificationToDatabase(sender, subject, messageContent, response.messageId, response.transactionId);
                    }
                })
                .catch(error => {
                    console.error('Failed to send message:', error);
                });
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
const messageContentPath = process.argv[2];
const subject = process.argv[3];
const sender = process.argv[4];
const filePath = process.argv[5];
const sendOptions = {
    app: process.argv[6],
    sms: process.argv[7],
    email: process.argv[8],
}

// Call the function to send notifications
sendNotifications(messageContentPath, subject, sender, filePath, sendOptions);
