import { sendNotification, generateUniqueId } from './novuUtilities.mjs';
import { updateDocument, generateRandomCode } from './mongodbUtilities.mjs';

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
