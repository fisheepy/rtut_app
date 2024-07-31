import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import { updateEmployeeToNovuSubscriber } from './novuUtilities.mjs'; // Adjust the import path as needed

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;
const MONGODB_URI = `mongodb+srv://${username}:${password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;

// Helper function to generate a random code for password
const generateRandomCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

// Helper function to generate a unique username
function generateUsername(firstName, lastName, usernameSet) {
  let baseUsername = `${firstName}${lastName.substring(0, Math.min(3, lastName.length))}`.toLowerCase();
  let username = baseUsername;
  let suffix = 1;
  while (usernameSet.has(username)) {
    username = `${baseUsername}${suffix}`;
    suffix++;
  }
  return username;
}

// Function to add a new employee and generate username and password
export async function addNewEmployee(newEmployee) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    const usernameSet = new Set(await collection.distinct('username'));
    const username = generateUsername(newEmployee.firstName, newEmployee.lastName, usernameSet);
    const password = generateRandomCode();

    const employeeDocument = {
      "First Name": newEmployee.firstName,
      "Last Name": newEmployee.lastName,
      "Hire Date": newEmployee.hireDate,
      "Position Status": 'Active',
      "Termination Date": '',
      "Home Department": newEmployee.homeDepartment,
      "Job Title": newEmployee.jobTitle,
      "Location": newEmployee.location,
      "Supervisor First Name": newEmployee.supervisorFirstName,
      "Supervisor Last Name": newEmployee.supervisorLastName,
      "Email": newEmployee.email,
      "Phone": newEmployee.phone,
      username,
      password
    };

    const result = await collection.insertOne(employeeDocument);
    console.log('New employee added:', employeeDocument);

    // Update the new employee to Novu subscriber
    await updateEmployeeToNovuSubscriber({
      'First Name': newEmployee.firstName,
      'Last Name': newEmployee.lastName,
      'Email': newEmployee.email, // Ensure email field is passed if available
      'Phone': newEmployee.phone // Ensure phone field is passed if available
    });

    return result;
  } catch (error) {
    console.error('Failed to add new employee:', error);
  } finally {
    await client.close();
  }
}

// Function to add an employee from a JSON file
const addEmployee = async (tempFilePath) => {
    try {
        const newEmployeeJSON = fs.readFileSync(tempFilePath, 'utf-8');
        const newEmployee = JSON.parse(newEmployeeJSON);
        console.log(newEmployee);

        const result = await addNewEmployee(newEmployee);
        console.log(`Document inserted with ID: ${result.insertedId}`);
        return result;
    } catch (error) {
        console.error('Error during MongoDB operation:', error);
        throw error;
    } finally {
        console.log('Connection to MongoDB closed');
    }
}

// Example usage:
if (process.argv.length < 3) {
    console.error('Usage: node addEmployee.mjs <tempFilePath>');
    process.exit(1);
}

const [tempFilePath] = process.argv.slice(2);

// Call the function to add an employee
addEmployee(tempFilePath);
