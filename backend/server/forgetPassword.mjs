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
    // Read the contents of the temporary file
    const selectedEmployeeJSON = fs.readFileSync(filePath, 'utf-8');

    try {
        // Parse the JSON string into an array of objects
        const selectedEmployee = JSON.parse(selectedEmployeeJSON);
        console.log(selectedEmployee);
        // Transform and format filteredValues
        const employee = transformFilteredValues(selectedEmployee);
        const newPassword = updatePasswordInDatabase({user:employee,password:''});
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
forgetPassword(filePath, sendOptions);
