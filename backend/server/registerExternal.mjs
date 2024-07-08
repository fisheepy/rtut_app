import { addExternalUser } from "./mongodbUtilities.mjs";

// Main function to handle the registration process
async function main() {
    const [firstName, lastName, password, type, phoneNumber, email] = process.argv.slice(2);

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

main().catch(console.error);
