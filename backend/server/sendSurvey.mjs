import fs from 'fs';
import crypto from 'crypto';
import { triggerSurveyNotification } from './novuUtilities.mjs';
import { saveSurveyToDatabase } from './mongodbUtilities.mjs';

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

// Function to generate a unique ID based on name information, subject, sender, and current time
function generateUniqueMessageId(firstName, lastName, subject, sender) {
    // Concatenate first name, last name, subject, sender, and current time
    const nameString = `${firstName}${lastName}${subject}${sender}${currentDataTime}`;

    // Use SHA-256 hashing algorithm to generate a unique hash value
    const hash = crypto.createHash('sha256');
    hash.update(nameString);
    return hash.digest('hex');
}

// Function to send notifications
const sendSurveys = async (subject, sender, surveyQuestionsFilePath, selectedEmployeesFilePath) => {
    // Read the contents of the temporary file
    const surveyQuestionsJSON = fs.readFileSync(surveyQuestionsFilePath, 'utf-8');
    const selectedEmployeesJSON = fs.readFileSync(selectedEmployeesFilePath, 'utf-8');

    try {
        // Parse the JSON string into an array of objects
        const selectedEmployees = JSON.parse(selectedEmployeesJSON);
        const surveyQuestions = JSON.parse(surveyQuestionsJSON);
        // Transform and format filteredValues
        const formattedValues = transformFilteredValues(selectedEmployees);
        const uniqueId = generateUniqueMessageId(subject, sender);

        // Trigger notification with unique ID
        await triggerSurveyNotification(formattedValues, JSON.stringify(surveyQuestions), subject, sender, uniqueId);

        console.log('Survey sent successfully');
        const recipiantNumber = formattedValues.length;
        await saveSurveyToDatabase(uniqueId, sender, subject, currentDataTime, JSON.stringify(surveyQuestions), recipiantNumber);
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
