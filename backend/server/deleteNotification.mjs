import { deleteNotification } from "./novuUtilities.mjs";
import { deleteNotificationHistory } from "./mongodbUtilities.mjs";

if (process.argv.length < 3) {
    console.error('Usage: node deleteNotification.mjs <messageId>');
    process.exit(1);
}

// Extract command-line arguments
const transactionId = process.argv[2];

// Call the function to delete notifications

await deleteNotification(transactionId).then(response => {
    console.log(response);
}).catch(error => {
    console.log(error);;
});;

await deleteNotificationHistory(transactionId).then(response => {
    console.log(response);
}).catch(error => {
    console.log(error);;
});;




