const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
const csvtojson = require('csvtojson');

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/build')))
const { parse } = require('json2csv');

const port = 3101;

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;

const uri = `mongodb+srv://${username}:${password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const csvFilePath = './backend/server/output.csv';

app.get('/employees', cors(), async (req, res, next) => {
    const loginName = req.query; // Extract firstName and lastName from query parameters
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(database_name);
        const collection = db.collection('employees');

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
        const isAdmin = admins.some(admin => admin['First Name'] === loginName.firstName);
        const isRoot = admins.some(admin => admin['First Name'] === loginName.firstName && admin['Type'] === 'root');
        if (isRoot) {
            filteredData = data;
        }
        else if (isAdmin) {
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
    const loginName = req.query;
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

// Define a route to handle the POST request for executing the script
app.post('/call-function-send-event', (req, res) => {
    const {creator,endDate,location,startDate,title} = req.body.data;

    exec(`node ./backend/server/sendEvent.mjs "${creator}" "${endDate}" "${location}" "${startDate}" "${title}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
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
        res.status(200).send(stdout);
    });
});

// Define a route to handle the POST request for executing the script
app.post('/call-function-send-notification', (req, res) => {
    const messageContent = req.body.body;
    const subject = req.body.subject;
    const sender = req.body.sender;
    const selectedEmployees = req.body.selectedEmployees;
    const sendEmail = req.body.sendEmail;
    const sendSms = req.body.sendSms;
    const sendApp = req.body.sendApp;

    // Construct the JSON string with proper formatting
    const selectedEmployeesJSON = JSON.stringify(selectedEmployees);

    // Write the JSON string to a temporary file
    const tempFilePath = path.join(__dirname, 'temp', 'selectedEmployees.json');
    fs.writeFileSync(tempFilePath, selectedEmployeesJSON);
    // Execute the script and pass the temporary file path as an argument
    exec(`node ./backend/server/sendNotification.mjs "${messageContent}" "${subject}" "${sender}" "${tempFilePath}" "${sendApp}" "${sendSms}" "${sendEmail}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

app.post('/call-function-send-survey', (req, res) => {
    const surveyJson = req.body.surveyJson;
    const selectedEmployees = req.body.selectedEmployees;
    // Construct the JSON string with proper formatting
    const selectedEmployeesJSON = JSON.stringify(selectedEmployees);
    const surveyQuestionsJSON = JSON.stringify(surveyJson);
    const subject = req.body.subject;
    const sender = req.body.sender;

    // Write the JSON string to a temporary file
    const selectedEmployeesFilePath = path.join(__dirname, 'temp', 'selectedEmployees.json');
    fs.writeFileSync(selectedEmployeesFilePath, selectedEmployeesJSON);

    const surveyQuestionsFilePath = path.join(__dirname, 'temp', 'surveyQuestions.json');
    fs.writeFileSync(surveyQuestionsFilePath, surveyQuestionsJSON);

    // Execute the script and pass the temporary file path as an argument
    exec(`node ./backend/server/sendSurvey.mjs "${subject}" "${sender}" "${surveyQuestionsFilePath}" "${selectedEmployeesFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

app.post('/submit-survey', async (req, res) => {
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

app.post('/fetch-events', async (req, res) => {
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

app.post('/call-function-add-employee', async (req, res) => {
    const newEmployee = req.body;
    const newEmployeeJSON = JSON.stringify(newEmployee);

    // Write the JSON string to a temporary file
    const tempFilePath = path.join(__dirname, 'temp', 'newEmployee.json');
    fs.writeFileSync(tempFilePath, newEmployeeJSON);
    // Execute the script
    exec(`node ./backend/server/addEmployee.mjs "${tempFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
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
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }
        res.status(200).send(stdout);
    });
});

app.post('/call-function-export-selected-employees', (req, res) => {
    const employees = req.body.employees;

    try {
        // Generate CSV
        const csv = parse(employees);
        res.header('Content-Type', 'text/csv');
        res.attachment('selected-employees.csv'); // Suggests a filename for the downloaded file
        res.send(csv);
    } catch (error) {
        console.error('Error generating CSV:', error);
        res.status(500).send('Failed to export employees to CSV');
    }
});

app.post('/call-function-import-employees', (req, res) => {
    const employees = req.body.employees;

    const employeesJSON = JSON.stringify(employees);

    // Write the JSON string to a temporary file
    const tempFilePath = path.join(__dirname, 'temp', 'employees.json');
    fs.writeFileSync(tempFilePath, employeesJSON);
    // Execute the script and pass the temporary file path as an argument
    exec(`node ./backend/server/importEmployeeData.mjs "${tempFilePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

app.get('/call-function-update-employee-token', (req, res) => {
    const firstName = 'Xuan';//req.body.firstName;
    const lastName = 'Yu';//req.body.lastName;
    const token = 'cfjS5dS_ZEQ1tzldAGGDmq:APA91bFeuRCgP5beNN9xrTmX5pXvHkFeurEpZmVsp_1dmkycb1i_NGpeC_R4QoMpKZoPC3Q-tryZ5-uO4c4-sgo1ap_IlEq1ztlsm_Fu-Aet6Mpdm572nWUcfVH839PQa3AfKnf_g-Th';//req.body.token;

    // Execute the script and pass the temporary file path as an argument
    exec(`node ./backend/server/updateEmployeeToken.mjs "${firstName}" "${lastName}" "${token}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            res.status(500).send(`Internal Server Error: ${error.message}`);
            return;
        }

        res.status(200).send('Script executed successfully');
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname + '/backend/client/public/index.html'))
});

// Start the server
app.listen(process.env.PORT || port, () => {
    console.log(`Server is running on port ${port}`);
});
