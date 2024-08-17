import { updateEventInDatabase } from './mongodbUtilities.mjs'

// Extract command-line arguments
const eventId = process.argv[2];
const updatedEvent = JSON.parse(process.argv[3]);

// Call the function to update the event
updateEventInDatabase(eventId, updatedEvent);
