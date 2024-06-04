import {generateAndSaveUsernames} from "./mongodbUtilities.mjs"

// Call the function to send notifications
await generateAndSaveUsernames().then(response => {
    console.log(`Generate UserNames successful!`);
}).catch(error => {
    console.log(error);;
});