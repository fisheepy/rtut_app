import { deleteEventFromDatabase } from './mongodbUtilities.mjs'; // Adjust the import based on your actual config file

// Check if command-line arguments are provided
if (process.argv.length < 3) {
    console.error('Usage: node deleteEvent.mjs <eventId>');
    process.exit(1);
}

// Extract command-line arguments
const eventId = process.argv[2];

// Call the function to delete the event
deleteEventFromDatabase(eventId);
