import { saveEventToDatabase } from './mongodbUtilities.mjs';

// Function to send notifications
const sendEvent = async (eventData) => {
    try {
        try {
            // Use the extracted MongoDB operation
            await saveEventToDatabase(eventData);
        } catch (error) {
            console.error('Error:', error.message);
        }
    } catch (error) {
        console.error('Error sending Event:', error.message);
    }
};

// Check if command-line arguments are provided
if (process.argv.length < 8) {
    console.error('Usage: node sendEvent.mjs <creator> <endDate> <location> <startDate> <title> <allDay>');
    process.exit(1);
}

// Extract command-line arguments
const creator = process.argv[2];
const endDate = process.argv[3];
const location = process.argv[4];
const startDate = process.argv[5];
const title = process.argv[6];
const allDay = process.argv[7];

const eventData = {creator,endDate,location,startDate,title,allDay};
// Call the function to send notifications
sendEvent(eventData);
