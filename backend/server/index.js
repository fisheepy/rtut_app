const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const FAISS_SERVER_URL = "https://rtut-app-admin-server-c2d4ae9d37ae.herokuapp.com";
const axios = require("axios");

const uploadDirectory = path.join(__dirname, 'uploads');

// Create the uploads directory if it doesn't exist
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/build')))

// Set the limit to 10MB or more as needed
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const port = 3101;

const database_username = process.env.MONGODB_USERNAME;
const database_password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;

const uri = `mongodb+srv://${database_username}:${database_password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// ✅ Route: Chat with AI
app.post("/chat", async (req, res) => {
    try {
        const { question } = req.body;
        const response = await axios.post(`${FAISS_SERVER_URL}/chat`, { question });
        res.json(response.data);
    } catch (error) {
        console.error("❌ Error calling FAISS server:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/employees', cors(), async (req, res, next) => {
    const loginName = req.query; // Extract firstName and lastName from query parameters
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('employees');

        // Query database to retrieve data with "Account Active" = 'Active'
        const data = await collection.find({ "Account Active": "Active" }).toArray();

        // Check if data is retrieved
        if (!data || data.length === 0) {
            console.error('No data found in MongoDB collection');
            res.status(404).send('No Data Found');
            return;
        }

        // Check if the user is a root user
        const adminCollection = db.collection('admins');
        const admins = await adminCollection.find().toArray();
        const isAdmin = admins.some(admin => admin['First Name'] === loginName.firstName);
        const isRoot = admins.some(admin => admin['First Name'] === loginName.firstName && admin['Type'] === 'root');

        let filteredData = [];

        if (isRoot) {
            filteredData = data;
        } else if (isAdmin) {
            // User is not a root user, filter data accordingly
            filteredData = data.filter(employee => isSupervisorOrSubordinate(employee, loginName, data));
        }

        // Send filtered data as JSON response
        res.json(filteredData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }

    // Function to check if an employee is the supervisor or subordinate of the given login name
    function isSupervisorOrSubordinate(employee, loginName, allEmployees) {
        if (employee["Supervisor First Name"].toUpperCase() === loginName.firstName.toUpperCase() &&
            employee["Supervisor Last Name"].toUpperCase() === loginName.lastName.toUpperCase()) {
            return true; // Employee directly reports to the login user
        } else {
            // Check recursively if the supervisor's supervisor is the login user
            const supervisor = allEmployees.find(emp => emp["First Name"] === employee["Supervisor First Name"] &&
                emp["Last Name"] === employee["Supervisor Last Name"]);
            if (supervisor) {
                return isSupervisorOrSubordinate(supervisor, loginName, allEmployees);
            }
        }
        return false;
    }
});

app.get('/notifications', cors(), async (req, res, next) => {
    const loginName = req.query; // Extract firstName and lastName from query parameters
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('notifications');

        // Query database to retrieve notification data
        const data = await collection.find().toArray();

        // Check if data is retrieved
        if (!data || data.length === 0) {
            console.error('No data found in MongoDB collection');
            res.status(404).send('No Data Found');
            return;
        }

        // Check if the user is a root user
        const adminCollection = db.collection('admins');
        const admins = await adminCollection.find().toArray();
        const isAdminRoot = admins.some(admin => admin['First Name'] === loginName.firstName && admin['Type'] === 'root');

        if (isAdminRoot) {
            // If the user is root, return all notification data
            res.json(data);
        } else {
            // Filter the notifications to only show the ones created by this admin
            const filteredData = data.filter(notification =>
                notification.adminUser?.firstName === loginName.firstName &&
                notification.adminUser?.lastName === loginName.lastName
            );

            if (filteredData.length > 0) {
                res.json(filteredData);
            } else {
                res.status(401).send('Not Authorized');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});

app.get('/surveys', cors(), async (req, res, next) => {
    const loginName = req.query; // Extract firstName and lastName from query parameters
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('survey forms');

        // Query database to retrieve data
        const data = await collection.find().toArray();

        // Check if data is retrieved
        if (!data || data.length === 0) {
            console.error('No data found in MongoDB collection');
            res.status(404).send('No Data Found');
            return;
        }

        // Check if the user is a root user
        const adminCollection = db.collection('admins');
        const admins = await adminCollection.find().toArray();
        const isAdminRoot = admins.some(admin => admin['First Name'] === loginName.firstName && admin['Type'] === 'root');

        if (isAdminRoot) {
            // If the user is root, return all survey data
            res.json(data);
        } else {
            // Filter the surveys to only show the ones created by this admin
            const filteredData = data.filter(survey =>
                survey.adminUser?.firstName === loginName.firstName &&
                survey.adminUser?.lastName === loginName.lastName
            );

            if (filteredData.length > 0) {
                res.json(filteredData);
            } else {
                res.status(401).send('Not Authorized');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});


app.get('/events', cors(), async (req, res, next) => {
    const loginName = req.query; // Extract firstName and lastName from query parameters
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('events');

        // Query database to retrieve data
        const data = await collection.find().toArray();

        // Check if data is retrieved
        if (!data || data.length === 0) {
            console.error('No data found in MongoDB collection');
            res.status(404).send('No Data Found');
            return;
        }

        // Check if the user is a root user
        const adminCollection = db.collection('admins');
        const admins = await adminCollection.find().toArray();
        const isAdmin = admins.some(admin => admin['First Name'] === loginName.firstName && admin['Type'] === 'root');
        // Filter data based on user's admin status

        if (isAdmin) {
            res.json(data);
        }
        else {
            res.status(401).send('Not Authorized');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});

app.get('/survey-results/:surveyId', cors(), async (req, res, next) => {
    const { surveyId } = req.params;
    const loginName = req.query; // Assuming loginName contains { firstName, lastName }

    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('survey results');

        // Query database to retrieve data
        const data = await collection.find({ UID: surveyId }).toArray();

        // Check if data is retrieved
        if (!data || data.length === 0) {
            console.error('No data found in MongoDB collection');
            res.status(404).send('No Data Found');
            return;
        }

        // Access the admin collection
        const adminCollection = db.collection('admins');
        const admins = await adminCollection.find().toArray();

        // Check if the user is a root admin
        const isAdminRoot = admins.some(admin => admin['First Name'] === loginName.firstName && admin['Type'] === 'root');

        // If the user is root, return all data
        if (isAdminRoot) {
            res.json(data);
        } else {
            // If the user is not root, check if they are the sender of the survey
            const filteredData = data.filter(survey =>
                survey.adminUser.firstName === loginName.firstName &&
                survey.adminUser.lastName === loginName.lastName
            );

            if (filteredData.length > 0) {
                res.json(filteredData);
            } else {
                res.status(401).send('Not Authorized to view this survey');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});


async function updateEmployeeInDatabase(employeeId, updatedEmployee) {
    try {
        await client.connect();
        const db = client.db(database_name);
        const collection = db.collection('employees');
        const { _id, ...employeeUpdate } = updatedEmployee;

        // Update the employee with the new information
        const result = await collection.updateOne(
            { _id: new ObjectId(employeeId) },
            { $set: employeeUpdate }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        console.error('Error updating employee in database:', error);
        throw error;
    } finally {
        await client.close();
    }
}

app.put('/employees/:id', async (req, res) => {
    const employeeId = req.params.id;
    const updatedEmployee = req.body;

    try {
        const success = await updateEmployeeInDatabase(employeeId, updatedEmployee);
        if (success) {
            res.status(200).send('Employee updated successfully');
        } else {
            res.status(404).send('Employee not found');
        }
    } catch (error) {
        res.status(500).send('Error updating employee');
    }
});

// Define a route to handle the POST request for executing the script
app.post('/call-function-send-event', (req, res) => {
    const { creator, endDate, location, startDate, title, allDay, detail, selectedEmployees } = req.body.data;
    const selectedEmployeesJSON = JSON.stringify(selectedEmployees);

    // Write the JSON string to a temporary file
    const tempFilePath = path.join(__dirname, 'temp', 'selectedEmployees.json');
    fs.writeFileSync(tempFilePath, selectedEmployeesJSON);
    exec(`node ./backend/server/sendEvent.mjs "${creator}" "${endDate}" "${location}" "${startDate}" "${title}" "${allDay}" "${detail}" "${tempFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

// Define a route to handle the POST request for deleting an event
app.post('/call-function-delete-event', (req, res) => {
    const { eventId } = req.body;

    exec(`node ./backend/server/deleteEvent.mjs "${eventId}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Event deleted successfully');
    });
});

// Define a route to handle the POST request for updating an event
app.post('/call-function-update-event', (req, res) => {
    const { eventId, updatedEvent } = req.body;

    const tempFilePath = path.join(__dirname, 'temp', 'updatedEvent.json');
    fs.writeFileSync(tempFilePath, JSON.stringify(updatedEvent));

    exec(`node ./backend/server/updateEvent.mjs "${eventId}" "${tempFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Event updated successfully');
    });
});

app.post('/call-function-send-one-time-code', async (req, res) => {
    const { firstName, lastName } = req.body;

    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');
        // Check if the user is an admin
        const adminCollection = client.db(database_name).collection('admins');
        const isAdmin = await adminCollection.findOne({
            "Last Name": lastName,
            "First Name": firstName
        });

        if (isAdmin) {
            // Execute the script to send the one-time code
            exec(`node ./backend/server/sendOTC.mjs "${firstName}" "${lastName}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing script: ${error.message}`);
                    res.status(500).send(`Internal Server Error: ${error.message}`);
                    return;
                }

                res.status(200).send('Script executed successfully');
            });
        } else {
            // User is not an admin, respond with an error message
            res.status(403).send('You are not authorized to request a one-time code');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});

app.post('/call-function-validate-log-in', async (req, res) => {
    const { firstName, lastName, enteredCode } = req.body;

    // Execute the script
    exec(`node ./backend/server/validateLogin.mjs "${firstName}" "${lastName}" "${enteredCode}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }
        if (stdout.includes("Login valid: true")) {
            res.status(200).send("Login successful");
        } else {
            res.status(401).send("Login failed: Invalid code or code expired");
        }
    });
});

app.get('/call-function-generate-user-names', async (req, res) => {
    // Execute the script
    exec(`node ./backend/server/generateUserNames.mjs`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }
        if (stdout.includes("Generate UserNames successful!")) {
            res.status(200).send("Generate UserNames successful!");
        } else {
            res.status(401).send("Generate UserNames error!");
        }
    });
});

app.post('/call-function-send-onboarding', async (req, res) => {
    const selectedEmployees = req.body.batch;
    // Construct the JSON string with proper formatting
    const selectedEmployeesJSON = JSON.stringify(selectedEmployees);

    // Write the JSON string to a temporary file
    const tempFilePath = path.join(__dirname, 'temp', 'selectedEmployees.json');
    fs.writeFileSync(tempFilePath, selectedEmployeesJSON);

    exec(`node ./backend/server/sendOnboarding.mjs "${tempFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

// Function to log errors to the database
const logErrorToDatabase = async (error, context) => {
    try {
        await client.connect();
        const db = client.db(database_name);
        const collection = db.collection('error logs');

        // Create an error log entry
        const errorLogEntry = {
            error: error.message,
            context,
            timestamp: new Date()
        };

        // Insert the error log entry into the collection
        await collection.insertOne(errorLogEntry);
        console.log('Error log saved successfully.');
    } catch (error) {
        console.error('Error saving error log:', error);
    } finally {
        await client.close();
    }
};

// Define a route to handle the POST request for executing the script
app.post('/call-function-send-notification', async (req, res) => {
    const messageContent = req.body.body;
    const subject = req.body.subject;
    const sender = req.body.sender;
    const selectedEmployees = req.body.selectedEmployees;
    const sendEmail = req.body.sendEmail;
    const sendSms = req.body.sendSms;
    const sendApp = req.body.sendApp;
    const adminUser = req.body.adminUser;

    // Construct the JSON string with proper formatting
    const selectedEmployeesJSON = JSON.stringify(selectedEmployees);
    const messageContentJSON = JSON.stringify({ messageContent });
    const adminUserJSON = JSON.stringify(adminUser);

    // Write the JSON string to a temporary file
    const tempFilePath = path.join(__dirname, 'temp', 'selectedEmployees.json');
    const messageContentFilePath = path.join(__dirname, 'temp', 'messageContent.json');
    const adminUserJSONFilePath = path.join(__dirname, 'temp', 'adminUser.json');

    fs.writeFileSync(tempFilePath, selectedEmployeesJSON);
    fs.writeFileSync(messageContentFilePath, messageContentJSON);
    fs.writeFileSync(adminUserJSONFilePath, adminUserJSON);

    // Execute the script and pass the temporary file path as an argument
    exec(`node ./backend/server/sendNotification.mjs "${messageContentFilePath}" "${subject}" "${sender}" "${tempFilePath}" "${sendApp}" "${sendSms}" "${sendEmail}" "${adminUserJSONFilePath}"`, async (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);

            // Log the error details to the database
            await logErrorToDatabase(error.message, stderr, 'sendNotification.mjs');

            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

app.post('/call-function-send-survey', (req, res) => {
    const surveyJson = req.body.surveyJson;
    const selectedEmployees = req.body.selectedEmployees;
    const adminUser = req.body.adminUser;
    // Construct the JSON string with proper formatting
    const selectedEmployeesJSON = JSON.stringify(selectedEmployees);
    const surveyQuestionsJSON = JSON.stringify(surveyJson);
    const adminUserJSON = JSON.stringify(adminUser);

    const subject = req.body.subject;
    const sender = req.body.sender;

    // Write the JSON string to a temporary file
    const selectedEmployeesFilePath = path.join(__dirname, 'temp', 'selectedEmployees.json');
    fs.writeFileSync(selectedEmployeesFilePath, selectedEmployeesJSON);

    const surveyQuestionsFilePath = path.join(__dirname, 'temp', 'surveyQuestions.json');
    fs.writeFileSync(surveyQuestionsFilePath, surveyQuestionsJSON);

    const adminUserJSONFilePath = path.join(__dirname, 'temp', 'adminUser.json');
    fs.writeFileSync(adminUserJSONFilePath, adminUserJSON);

    // Execute the script and pass the temporary file path as an argument
    exec(`node ./backend/server/sendSurvey.mjs "${subject}" "${sender}" "${surveyQuestionsFilePath}" "${selectedEmployeesFilePath}" "${adminUserJSONFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

app.post('/call-function-add-employee', async (req, res) => {
    const newEmployee = req.body;
    const newEmployeeJSON = JSON.stringify(newEmployee);

    // Write the JSON string to a temporary file
    const tempFilePath = path.join(__dirname, 'temp', 'newEmployee.json');
    fs.writeFileSync(tempFilePath, newEmployeeJSON);

    // Execute the script
    exec(`node ./backend/server/addEmployee.mjs "${tempFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            // Find the relevant error line
            const errorLines = stderr.split('\n');
            const relevantError = errorLines.find(line => line.includes("Error during operation"));

            if (relevantError) {
                // Remove "Error during operation: " text
                const cleanErrorMessage = relevantError.replace("Error during operation: ", "");
                res.status(500).send(cleanErrorMessage);
            } else {
                res.status(500).send(`Internal Server Error: ${error.message}`);
            }
            return;
        }
        res.status(200).send(stdout);
    });
});


app.post('/call-function-delete-employee', async (req, res) => {
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;

    // Execute the script
    exec(`node ./backend/server/deleteEmployee.mjs "${firstName}" "${lastName}"`, (error, stdout, stderr) => {
        if (error) {
            // Find the relevant error line
            const errorLines = stderr.split('\n');
            const relevantError = errorLines.find(line => line.includes("Error during operation"));

            if (relevantError) {
                // Remove "Error during operation: " text
                const cleanErrorMessage = relevantError.replace("Error during operation: ", "");
                res.status(500).send(cleanErrorMessage);
            } else {
                res.status(500).send(`Internal Server Error: ${error.message}`);
            }
            return;
        }
        res.status(200).send(stdout.trim());
    });
});

app.post('/call-function-import-employees', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const tempFilePath = req.file.path;

    exec(`node ./backend/server/importEmployeeData.mjs "${tempFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        // Optionally delete the temporary file after processing
        fs.unlink(tempFilePath, (err) => {
            if (err) console.error(`Failed to delete temp file: ${err.message}`);
        });

        res.status(200).send('Script executed successfully');
    });
});

app.post('/call-function-delete-notification', (req, res) => {
    const transactionId = req.body.transactionId;

    // Execute the script and pass the temporary file path as an argument
    exec(`node ./backend/server/deleteNotification.mjs "${transactionId}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

app.post('/call-function-activate-app-usage', async (req, res) => {
    const users = JSON.stringify(req.body);
    // Write the JSON string to a temporary file
    const tempFilePath = path.join(__dirname, 'temp', 'activateUsers.json');
    fs.writeFileSync(tempFilePath, users);

    // Execute the script and pass the temporary file path as an argument
    exec(`node ./backend/server/activateAppUsage.mjs "${tempFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

app.post('/api/submit-survey', async (req, res) => {
    try {
        // Retrieve the survey result data from the request body
        const { surveyId, answers, timestamp } = req.body;

        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('survey results');

        // Insert the survey data into the MongoDB collection
        await collection.insertOne({ UID: surveyId, answers, timestamp });

        console.log('Survey data inserted successfully');
        res.status(200).send('Survey result received successfully');
    } catch (error) {
        console.error('Error handling survey submission:', error.message);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});

// Endpoint to handle user registration
app.post('/api/register_external',
    [
        body('firstName').notEmpty().withMessage('First Name is required'),
        body('lastName').notEmpty().withMessage('Last Name is required'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
            .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
            .matches(/\d/).withMessage('Password must contain at least one number')
            .matches(/[@$!%*#?&]/).withMessage('Password must contain at least one special character'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { firstName, lastName, password, type, phoneNumber, email } = req.body;
        // Execute the script
        exec(`node ./backend/server/registerExternal.mjs "${firstName}" "${lastName}" "${password}" "${type}" "${phoneNumber}" "${email}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing script: ${error.message}`);
                res.status(500).send(`Internal Server Error: ${error.message}`);
                return;
            }
            console.log(stdout);
            if (stdout.includes("Register valid: true")) {
                res.status(200).send("Register successful");
            } else {
                res.status(401).send("Register failed");
            }
        });
    }
);

app.post('/api/submit-feedback', async (req, res) => {
    try {
        // Retrieve the feedback data from the request body
        const { name, feedback } = req.body;

        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('feedback');

        // Insert the feedback data into the MongoDB collection
        await collection.insertOne({ name, feedback, timestamp: new Date() });

        console.log('Feedback data inserted successfully');
        res.status(200).send('Feedback received successfully');
    } catch (error) {
        console.error('Error handling feedback submission:', error.message);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});

app.post('/api/fetch-events', async (req, res) => {
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');
        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('events');
        const data = await collection.find().toArray();
        // Check if data is retrieved
        if (!data || data.length === 0) {
            console.error('No data found in MongoDB collection');
            res.status(404).send('No Data Found');
            return;
        }
        res.json(data);
    } catch (error) {
        console.error('Error handling event fetching:', error.message);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});

app.post('/api/register_token', (req, res) => {
    try {
        const { token, user } = req.body;
        console.log('Received token:', token);
        console.log('Received user info:', user);

        const firstName = user.userFirstName;//req.body.firstName;
        const lastName = user.userLastName;//req.body.lastName;

        // Execute the script and pass the temporary file path as an argument
        exec(`node ./backend/server/updateEmployeeToken.mjs "${firstName}" "${lastName}" "${token}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing script: ${error.message}`);
                res.status(500).send(`Internal Server Error: ${error.message}`);
                return;
            }

            res.status(200).json({ message: 'Token and user info received successfully' });
        });
    } catch (error) {
        console.error('Error handling password reset:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/reset-password',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('newPassword')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
            .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
            .matches(/\d/).withMessage('Password must contain at least one number')
            .matches(/[@$!%*#?&]/).withMessage('Password must contain at least one special character'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { userId, newPassword } = req.body;
        try {
            // Connect to MongoDB
            await client.connect();
            console.log('Connected to MongoDB');

            // Access the database and collection
            const db = client.db(database_name);
            const collection = db.collection('employees');

            // Find the user
            const user = await collection.findOne({ username: userId });

            // Check if user exists
            if (!user) {
                console.error('No valid login found in MongoDB collection');
                res.status(404).json({ message: 'User not found' });
                return;
            }

            // Update the user's password and set the password reset date
            const updateResult = await collection.updateOne(
                { username: userId },
                { $set: { password: newPassword, passwordResetDate: new Date() } }
            );

            if (updateResult.modifiedCount === 1) {
                res.status(200).json({ message: 'Password reset successful' });
            } else {
                res.status(500).json({ message: 'Failed to update password' });
            }

        } catch (error) {
            console.error('Error handling password reset:', error.message);
            res.status(500).send('Internal Server Error');
        } finally {
            // Close the MongoDB connection
            await client.close();
            console.log('Connection to MongoDB closed');
        }
    }
);

// API endpoint to handle forget-password requests
app.post('/api/forget-password', async (req, res) => {
    const { phone } = req.body;
    try {
        const digits = phone.replace(/\D/g, '');
        if (digits.length !== 10) {
            throw new Error('Invalid phone number format. Must contain 10 digits.');
        }
        const Phone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        console.log(`Formatted phone: ${Phone}`);
        await client.connect();
        const db = client.db(database_name);
        const collection = db.collection('employees');

        // Construct regex pattern
        const regexPattern = `.*${digits.split('').join('.*')}.*`;

        // Match user by regex
        const user = await collection.findOne({
            Phone: { $regex: regexPattern }
        });
        console.log(user);

        if (!user) {
            console.error('User not found');
            res.status(404).json({ message: 'User not found' });
            return;
        }
        else {
            const userId = user.username;
            console.log(userId);
    
            // Execute the MJS script with necessary parameters
            exec(`node ./backend/server/forgetPassword.mjs "${userId}" "${uri}" "${database_name}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing script: ${error.message}`);
                    res.status(500).send(`Internal Server Error: ${error.message}`);
                    return;
                }
    
                console.log(stdout);
                res.status(200).json({ message: 'Password reset successful' });
            });
        }
    } catch (error) {
        console.error('Error handling forget password:', error.message);
        res.status(500).send('Internal Server Error');
    } finally {
        await client.close();
    }
});

app.post('/api/accept-disclaimer', async (req, res) => {
    async function activateUserIfNeeded(userInfo, accepted, collection) {
        if (userInfo.isActivated !== 'true' && accepted) {
            // Update user to activate account and set activation date
            await collection.updateOne(
                { username: { $regex: new RegExp(`^${userInfo.username}$`, 'i') } },
                {
                    $set: {
                        isActivated: 'true',
                        activationDate: new Date()
                    }
                }
            );
        }
    }

    async function logDisclaimerAcceptance(userInfo, accepted, appVersion, deviceInfo, db) {
        // Log acceptance details in a separate collection
        const acceptanceRecord = {
            username: userInfo.username,
            accepted,
            appVersion,
            deviceInfo,
            timestamp: new Date()
        };
        const logCollection = db.collection('disclaimer acceptances');
        await logCollection.insertOne(acceptanceRecord);
    }

    try {
        const { accepted, username, appVersion, deviceInfo } = req.body;

        if (!accepted || !username) {
            return res.status(400).send('Missing required fields');
        }

        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database and collection
        const db = client.db(database_name);
        const collection = db.collection('employees');

        // Fetch the user from the database
        const user = await collection.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        });

        if (!user) {
            console.error('User not found in MongoDB collection');
            return res.status(404).send('User not found');
        }

        // Activate user if needed
        await activateUserIfNeeded(user, accepted, collection);

        // Log the disclaimer acceptance to a separate collection
        await logDisclaimerAcceptance(user, accepted, appVersion, deviceInfo, db);

        res.status(200).send('Disclaimer Accepted and Logged!');
    } catch (error) {
        console.error('Error handling disclaimer acceptance:', error.message);
        res.status(500).send('Internal Server Error');
    } finally {
        // Ensure the MongoDB connection is closed
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});

app.post('/api/authentication', async (req, res) => {
    try {
        let { userName, password } = req.body;
        userName = userName.trim();

        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('employees');

        const user = await collection.find({
            username: { $regex: new RegExp(`^${userName}$`, 'i') },
            password: password
        }).toArray();

        if (!user || user.length === 0) {
            console.error('No valid login found in MongoDB collection');
            res.status(404).send('Validation failed');
            return;
        }

        // Extract the user object
        const userInfo = user[0];

        res.json([userInfo]);  // Respond with the user info array
    } catch (error) {
        console.error('Error handling validation:', error.message);
        res.status(500).send('Internal Server Error');
    } finally {
        // Close the MongoDB connection
        await client.close();
        console.log('Connection to MongoDB closed');
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname + '/backend/client/public/index.html'))
});

// Start the server
app.listen(process.env.PORT || port, () => {
    console.log(`Server is running on port ${port}`);
});
