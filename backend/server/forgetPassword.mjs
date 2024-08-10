import fs from 'fs';
import crypto from 'crypto';
import { sendNovuNotification } from './novuUtilities.mjs';
import { saveNotificationToDatabase, updatePasswordInDatabase } from './mongodbUtilities.mjs';

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
        'Phone': Phone,
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
            Phone: Phone,

        };
        return formattedData;
    });
};

// Function to send notifications
const forgetPassword = async (filePath, sendOptions) => {
    try {
        // Read the contents of the temporary file
        const selectedEmployeeJSON = fs.readFileSync(filePath, 'utf-8');
        
        // Parse the JSON string into a user object
        const user = JSON.parse(selectedEmployeeJSON);

        // Update password in the database and retrieve the updated user
        const updatedUser = await updatePasswordInDatabase(user, '');

        if (!updatedUser) {
            console.error('Failed to update password in the database.');
            return;
        }

        const messageType = 'NOTIFICATION';
        const subject = 'Forget Password';
        const sender = 'RTUT App Admin';
        const messageContent = `Hello ${updatedUser['First Name']}, `
            + `A password reset was requested for your account. `
            + `Your username is: ${updatedUser['username']}. Your new password is: ${updatedUser['password']}. `
            + `Please contact HR if you did not request this reset.`;
        const employee = transformFilteredValues(updatedUser);
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
            } else {
                console.error('Failed to send message: Response not successful');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    } catch (error) {
        console.error('Error processing forget password:', error.message);
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
};

// Call the function to send notifications
forgetPassword(filePath, sendOptions);
