import { findDocument } from './mongodbUtilities.mjs';

const validateLogin = async (firstName, lastName, requestedCode) => {
    const filter = { "Payroll Name": `${lastName}, ${firstName}` };
    const result = await findDocument('admins', filter);
    let isValidLogin = false;
    const currentTime = Date.now();

    if (result) {
        const elapsedTime = currentTime - result.timestamp;

        if ((elapsedTime > 0) && (elapsedTime < 3 * 60 * 1000) && result.requestedCode === requestedCode) {
            isValidLogin = true;
        }
    }
    return isValidLogin;
};

// Check if command-line arguments are provided
if (process.argv.length < 5) {
    console.error('Usage: node validateLogin.mjs <firstName> <lastName> <requestedCode>');
    process.exit(1);
}

// Extract command-line arguments
const firstName = process.argv[2];
const lastName = process.argv[3];
const requestedCode = process.argv[4];

const isValidLogin = await validateLogin(firstName, lastName, requestedCode);
console.log(`Login valid: ${isValidLogin}`);
