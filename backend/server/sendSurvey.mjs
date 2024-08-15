import fs from 'fs';
import crypto from 'crypto';
import { saveSurveyToDatabase } from './mongodbUtilities.mjs';
import { sendNovuNotification } from './novuUtilities.mjs';

const currentDataTime = Date.now();

// Function to generate a unique ID based on name information
function generateUniqueUserId(firstName, lastName) {
    // Concatenate first name and last name to form a single string
    const nameString = `${firstName}${lastName}`;

    // Use SHA-256 hashing algorithm to generate a unique hash value
    const hash = crypto.createHash('sha256');
    hash.update(nameString);
    return hash.digest('hex');
}

// Function to split PayrollName and format filteredValues
const transformFilteredValues = (filteredValues) => {
    return filteredValues.map(({
        'First Name': firstName,
        'Last Name': lastName,
        'Email': email,
        'Phone': phone }) => {
        // Construct the object with formatted data
        const formattedData = {
            subscriberId: generateUniqueUserId(
                firstName.toUpperCase(),
                lastName.toUpperCase()
            ),
            firstName: firstName,
            lastName: lastName
        };

        if (email) {
            formattedData.email = email;
        }

        if (phone) {
            formattedData.phone = phone;
        }

        return formattedData;
    });
};

// Function to send notifications
const sendSurveys = async (subject, sender, surveyQuestionsFilePath, selectedEmployeesFilePath) => {
    // Read the contents of the temporary file
    const surveyQuestionsJSON = fs.readFileSync(surveyQuestionsFilePath, 'utf-8');
    const selectedEmployeesJSON = fs.readFileSync(selectedEmployeesFilePath, 'utf-8');
    const messageType = 'SURVEY';
    try {
        // Parse the JSON string into an array of objects
        const selectedEmployees = JSON.parse(selectedEmployeesJSON);
        const surveyQuestions = JSON.parse(surveyQuestionsJSON);
        // Transform and format filteredValues
        const formattedValues = transformFilteredValues(selectedEmployees);
        // Trigger notification with unique ID
        const recipiantNumber = formattedValues.length;
        const sendOptions = {
            app: 'true',
            sms: 'false',
            email: 'false',
        }
        
        try {
            // Use the extracted Novu operation
            await sendNovuNotification(formattedValues, JSON.stringify(surveyQuestions), messageType, subject, sender, sendOptions)
                .then(response => {
                    if (response.success) {
                        console.log('Survey sent successfully:', response.messageId, response.transactionId, response.uniqueId);
                        // Use the extracted MongoDB operation
                        saveSurveyToDatabase(response.uniqueId, sender, subject, currentDataTime, JSON.stringify(surveyQuestions), recipiantNumber, response.transactionId);
                    }
                })
                .catch(error => {
                    console.error('Failed to send survey:', error);
                });
        } catch (error) {
            console.error('Error:', error.message);
        }
    } catch (error) {
        console.error('Error parsing selectedEmployeesJSON:', error.message);
    }
};

// Check if command-line arguments are provided
if (process.argv.length < 6) {
    console.error('Usage: node sendNotification.mjs <subject> <sender> <selectedEmployeesFilePath> <surveyQuestionsFilePath>');
    process.exit(1);
}

// Extract command-line arguments
const subject = process.argv[2];
const sender = process.argv[3];
const surveyQuestionsFilePath = process.argv[4];
const selectedEmployeesFilePath = process.argv[5];

// Call the function to send notifications
sendSurveys(subject, sender, surveyQuestionsFilePath, selectedEmployeesFilePath);
