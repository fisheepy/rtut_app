import crypto from 'crypto';
import { sendNotification } from './novuUtilities.mjs';
import { updateDocument } from './mongodbUtilities.mjs';

// Function to generate a random alphanumeric code
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

// Function to send notifications
const sendOTCNotifications = async (firstName, lastName, requestedCode) => {
    try {
        const uid = generateUniqueId(
            firstName.toUpperCase(),
            lastName.toUpperCase()
        );
        await sendNotification('one-time-code', { subscriberId: uid }, {
            messageContent: requestedCode,
            messageType: 'OTC',
        });

        console.log('Send OTC succeeded!');
        const filter = { "Last Name": lastName, "First Name": firstName };
        const updateDoc = {
          $set: { 
            requestedCode: requestedCode,
            timestamp: Date.now()
          }
        };
        
        await updateDocument('admins', filter, updateDoc);
    } catch (error) {
        console.log('Send OTC failed!');
        console.log(error);
    }
};

// Check if command-line arguments are provided
if (process.argv.length < 4) {
    console.error('Usage: node sendOTCNotifications.mjs <firstName> <lastName>');
    process.exit(1);
}

// Extract command-line arguments
const firstName = process.argv[2];
const lastName = process.argv[3];
const requestedCode = generateRandomCode();

// Call the function to send notifications
sendOTCNotifications(firstName, lastName, requestedCode);
