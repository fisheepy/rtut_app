import fs from 'fs';
import { Novu } from '@novu/node';
import { generateUniqueId } from './novuUtilities.mjs'; // Adjust the import path as needed
const novu = new Novu(process.env.NOVU_API);

// Function to split PayrollName and format filteredValues
const transformFilteredValues = (filteredValues) => {
    return filteredValues.map(({ 'Payroll Name': PayrollName, Email, Phone }) => {
        // Split PayrollName into firstName and lastName
        const [lastName, firstName] = PayrollName.split(',').map(name => name.trim());

        // Construct the object with formatted data
        const formattedData = {
            subscriberId: generateUniqueId(
                firstName.toUpperCase(),
                lastName.toUpperCase()
            ),
            firstName: firstName,
            lastName: lastName
        };

        return formattedData;
    });
};

// Function to send notifications
const deleteAllNotifications = async (filePath) => {
    // Read the contents of the temporary file
    const selectedEmployeesJSON = fs.readFileSync(filePath, 'utf-8');

    try {
        // Parse the JSON string into an array of objects
        const selectedEmployees = JSON.parse(selectedEmployeesJSON);

        // Transform and format filteredValues
        const formattedValues = transformFilteredValues(selectedEmployees);

        try {
            // Example of asynchronous operation with formattedValues
            const processFormattedValues = async (formattedValues) => {
                for (const value of formattedValues) {
                    const subscriberId = formattedValues.subscriberId;
                    const params = {subscriberId: subscriberId};
                    let notification_id = null;
                    // Example asynchronous operation with each subscriberId
                    await novu.messages.list(params).then(response => {
                        console.log(response.data.data[1].transactionId);
                        notification_id = response.data.data[1].transactionId;
                    });
                    await novu.messages.deleteById(notification_id).then(response => {
                        console.log(response);
                    }).catch(error => {
                        console.log(error);
                    });
                }
            };

            // Call the function with formattedValues
            processFormattedValues(formattedValues).then(() => {
                console.log('Processed all formatted values');
            }).catch(error => {
                console.error('An error occurred:', error.message);
            });
        } catch (error) {
            console.error('Error:', error.message);
        }
    } catch (error) {
        console.error('Error parsing selectedEmployeesJSON:', error.message);
    }
};

// Check if command-line arguments are provided
if (process.argv.length < 3) {
    console.error('Usage: node sendNotification.mjs <messageContent> <subject> <sender> <filePath>');
    process.exit(1);
}

// Extract command-line arguments
const filePath = process.argv[2];

// Call the function to send notifications
deleteAllNotifications(filePath);
