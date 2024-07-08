import { addExternalUser } from "./mongodbUtilities.mjs";

// Main function to handle the registration process
async function main(firstName, lastName, password, type, phoneNumber, email) {
    console.log({firstName, lastName, password, type, phoneNumber, email});
    
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

const [firstName, lastName, password, type, phoneNumber, email] = process.argv.slice(2);
main(firstName, lastName, password, type, phoneNumber, email).catch(console.error);
