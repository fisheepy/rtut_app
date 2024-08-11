import { sendNovuNotification } from './novuUtilities.mjs';
import { MongoClient } from 'mongodb';

// Helper function to generate a random code for password
const generateRandomCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
};

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
const transformFilteredValues = (user) => {
    // Construct the object with formatted data
    const formattedData = {
        subscriberId: generateUniqueId(
            user['First Name'].toUpperCase(),
            user['Last Name'].toUpperCase()
        ),
        firstName: user['First Name'],
        lastName: user['Last Name'],
        username: user['username'],
        password: user['password'],
        Email: '',
        Phone: user['Phone'],
    };
    console.log(formattedData);

    return formattedData;
};

// Function to send a notification
const sendNotification = async (user, newPassword) => {
    const messageContent = `Hello ${user['First Name']}, a password reset was requested for your account. Your username is: ${user.username}. Default password is: ${newPassword}. Please contact HR if you did not create the request.`;
    const formattedValues = transformFilteredValues(user);

    const response = await sendNovuNotification(
        formattedValues,
        messageContent,
        'NOTIFICATION',
        'Forget Password',
        'RTUT App Admin',
        { app: 'false', sms: 'true', email: 'false' }
    );

    return response;
};

// Main function to handle the process
const main = async () => {
    const args = process.argv.slice(2);
    const userId = args[0];
    const MONGODB_URI = args[1];
    const database_name = args[2];

    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(database_name);
        const collection = db.collection('employees');

        const user = await collection.findOne({ username: userId });

        if (!user) {
            throw new Error('User not found');
        }

        // Generate a new password and update the user
        const newPassword = generateRandomCode();
        await collection.updateOne({ username: userId }, { $set: { password: newPassword } });
        console.log(user);
        // Send notification
        const response = await sendNotification(user, newPassword);
        if (response.success) {
            console.log('Notification sent successfully:', response.messageId, response.transactionId);
        } else {
            console.error('Failed to send notification:', response.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
};

main();
