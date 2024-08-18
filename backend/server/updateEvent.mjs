import { updateEventInDatabase } from './mongodbUtilities.mjs';
import fs from 'fs';

// Extract command-line arguments
const eventId = process.argv[2];
const tempFilePath = process.argv[3];

// Read the updated event from the JSON file
const updatedEvent = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));

// Call the function to update the event
updateEventInDatabase(eventId, updatedEvent);
