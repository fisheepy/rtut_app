import { activateAppUsers } from './mongodbUtilities.mjs';
import fs from 'fs';
 
// Check if command-line arguments are provided
if (process.argv.length < 3) {
    console.error('Usage: Not enough inputs');
    process.exit(1);
}

// Extract command-line arguments
const filePath = process.argv[2];
const selectedUsersJSON = fs.readFileSync(filePath, 'utf-8');
const users = JSON.parse(selectedUsersJSON);   
activateAppUsers(users);