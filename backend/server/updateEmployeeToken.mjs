import { updateEmployeeNovuSubscriberToken } from './novuUtilities.mjs';

const updateToken = async (firstName, lastName, token) => {
    try {
        await updateEmployeeNovuSubscriberToken(firstName, lastName, token);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

if (process.argv.length < 5) {
    console.error('Usage: node updateEmployeeToken.mjs <firstName> <lastName> <token>');
    process.exit(1);
}

// Extract command-line arguments
const firstName = process.argv[2];
const lastName = process.argv[3];
const token = process.argv[4];

// Call the function to send notifications
updateToken(firstName, lastName, token);
