import fs from 'fs';
import crypto from 'crypto';
import { sendNovuNotification } from './novuUtilities.mjs';
import { saveNotificationToDatabase, updatePasswordInDatabase } from './mongodbUtilities.mjs';

// Function to send notifications
const forgetPassword = async (filePath, sendOptions) => {
    // Read the contents of the temporary file
    const selectedEmployeeJSON = fs.readFileSync(filePath, 'utf-8');
    try {
        // Parse the JSON string into an array of objects
        const user = JSON.parse(selectedEmployeeJSON);
        // Transform and format filteredValues
        const password = '';
        const newPassword = updatePasswordInDatabase(user,password);
        // Iterate through each formatted employee and send notification
        const messageType = 'NOTIFICATION';
        const subject = 'Forget Password';
        const sender = 'RTUT App Admin';
        const messageContent = 'Hello ' + employee.firstName + ', '
            + 'A password to your account was requested. '
            + 'Your username is: ' + employee.username + '. Default password is: ' + newPassword + '.'
            + 'Please contact HR if you did not create the request.';

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
    } catch (error) {
        console.error('Error parsing selectedEmployeesJSON:', error.message);
    }
};

// Check if command-line arguments are provided
if (process.argv.length < 3) {
    console.error('Usage: node forgetPassword.mjs <filePath>');
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
forgetPassword(filePath, sendOptions);
