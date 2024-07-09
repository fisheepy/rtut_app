import { addExternalUser } from "./mongodbUtilities.mjs";

// Main function to handle the registration process
async function main(firstName, lastName, password, type, phoneNumber, email) {   
    if (!firstName || !lastName || !password || !type) {
        console.error('Missing required fields');
        process.exit(1);
    }

    const success = await addExternalUser(firstName, lastName, password, type, phoneNumber, email);
    if (success) {
        console.log("Register valid: true");
    } else {
        console.log("Register valid: false");
    }
}

// Check if command-line arguments are provided
if (process.argv.length < 8) {
    console.error('Usage: Not enough inputs');
    process.exit(1);
}

// Extract command-line arguments
const firstName = process.argv[2];
const lastName = process.argv[3];
const password = process.argv[4];
const type = process.argv[5];
const phoneNumber = process.argv[6];
const email = process.argv[7];
main(firstName, lastName, password, type, phoneNumber, email);
