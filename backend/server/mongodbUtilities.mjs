import { MongoClient, ObjectId } from 'mongodb';
import { DateTime } from 'luxon';
import { updateEmployeeToNovuSubscriber } from './novuUtilities.mjs';

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;
const MONGODB_URI = `mongodb+srv://${username}:${password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;

// Helper function to generate a random code for password
export const generateRandomCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

// Helper function to generate a unique username
export function generateUsername(firstName, lastName, usernameSet) {
  let baseUsername = `${firstName}${lastName.substring(0, Math.min(3, lastName.length))}`.toLowerCase();
  let username = baseUsername;
  let suffix = 1;
  while (usernameSet.has(username)) {
    username = `${baseUsername}${suffix}`;
    suffix++;
  }
  return username;
}

// Function to generate and save usernames for all employees
export async function generateAndSaveUsernames() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    // Find employees who do not have a username or password set
    const employees = await collection.find({
      $or: [
        { username: { $exists: false } },
        { password: { $exists: false } }
      ]
    }).toArray();

    const usernameSet = new Set();

    for (const employee of employees) {
      // Check if the employee already has a username and password
      if (!employee.username || !employee.password) {
        let username = generateUsername(employee['First Name'], employee['Last Name'], usernameSet);
        usernameSet.add(username);
        let password = generateRandomCode();

        await collection.updateOne(
          { _id: employee._id },
          { $set: { username, password } }
        );

      }
    }
  } catch (error) {
    console.error('Failed to update usernames:', error);
  } finally {
    await client.close();
  }
}


// Function to save an event to the database
export const saveEventToDatabase = async (eventData) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('events');

    const startDate = DateTime.fromISO(eventData.startDate, { zone: 'America/New_York' }).toUTC().toJSDate();
    const endDate = DateTime.fromISO(eventData.endDate, { zone: 'America/New_York' }).toUTC().toJSDate();

    const allDay = eventData.allDay;
    const creator = eventData.creator;
    const location = eventData.location;
    const title = eventData.title;
    const detail = eventData.detail;
    const employees = eventData.employees;

    if (allDay === 'true') {
      startDate.setUTCHours(8, 0, 0, 0);
      endDate.setUTCHours(23, 59, 59, 999);
    }

    const event = {
      creator,
      location,
      startDate,
      endDate,
      title,
      allDay: allDay === 'true',
      detail,
      employees,
    };

    await collection.insertOne(event);
    console.log('Event form saved to database successfully');
  } catch (error) {
    console.error('Error handling saving Event form to database:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
}

// Function to delete an event from the database
export const deleteEventFromDatabase = async (eventId) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('events');

    const result = await collection.deleteOne({ _id: new ObjectId(eventId) });

    if (result.deletedCount === 1) {
      console.log('Event deleted successfully');
    } else {
      console.error('No event found with the provided ID');
    }
  } catch (error) {
    console.error('Error deleting event:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
};

// Function to update an event in the database
export const updateEventInDatabase = async (eventId, updatedEvent) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('events');

    const startDate = DateTime.fromISO(updatedEvent.startDate, { zone: 'America/New_York' }).toUTC().toJSDate();
    const endDate = DateTime.fromISO(updatedEvent.endDate, { zone: 'America/New_York' }).toUTC().toJSDate();

    const eventUpdate = {
      creator: updatedEvent.creator,
      location: updatedEvent.location,
      startDate,
      endDate,
      title: updatedEvent.title,
      allDay: updatedEvent.allDay,
      detail: updatedEvent.detail,
    };

    const result = await collection.updateOne({ _id: new ObjectId(eventId) }, { $set: eventUpdate });

    if (result.modifiedCount === 1) {
      console.log('Event updated successfully');
    } else {
      console.log('No changes made to the event');
    }
  } catch (error) {
    console.error('Error updating event in database:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
};

// Function to update password in the database
export const updatePasswordInDatabase = async (user, password) => {
  const client = new MongoClient(MONGODB_URI);
  let newPassword;
  if (password === '') {
    newPassword = generateRandomCode();
  } else {
    newPassword = password;
  }

  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    const result = await collection.findOneAndUpdate(
      { '_id': user['_id'] },
      { $set: { password: newPassword } },
      { returnDocument: 'after' } // Ensure you use findOneAndUpdate to return the updated document
    );

    if (!result.value) {
      console.error('User not found');
      return null;
    }

    return result.value; // Return the updated user document
  } catch (error) {
    console.error('Error updating password in database:', error);
    throw error;
  } finally {
    await client.close();
  }
};

// Function to activate app users and add them to the database
export const activateAppUsers = async (users) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    // Collect all existing usernames to ensure uniqueness
    const existingUsernames = new Set(await collection.distinct('username'));

    for (const user of users) {
      const {
        firstName,
        lastName,
        Phone,
        Email,
        hireDate,
        positionStatus,
        homeDepartment,
        jobTitle,
        location,
        reportTo,
        workCategory,
        payCategory,
        eeoEstablishment,
      } = user;

      const filter = {
        'First Name': firstName,
        'Last Name': lastName,
      };

      // Extract supervisor's first name and last name
      let supervisorFirstName = '';
      let supervisorLastName = '';
      if (reportTo) {
        const [last, first] = reportTo.split(',').map(name => name.trim());
        supervisorFirstName = first;
        supervisorLastName = last;
      }

      // Find existing employee
      const existingEmployee = await collection.findOne(filter);

      if (!existingEmployee) {
        // Generate a username and password for new employees
        const username = generateUsername(firstName, lastName, existingUsernames);
        existingUsernames.add(username);
        const password = generateRandomCode();

        // If the employee doesn't exist, insert a new record with activation info
        const newEmployee = {
          'First Name': firstName,
          'Last Name': lastName,
          Phone,
          Email,
          username,
          password,
          'Hire Date': hireDate,
          'Position Status': positionStatus,
          'Home Department': homeDepartment,
          'Job Title': jobTitle,
          'Location': location,
          'Supervisor First Name': supervisorFirstName,
          'Supervisor Last Name': supervisorLastName,
          'Worker Category': workCategory,
          'Pay Category': payCategory,
          'EEOC Establishment': eeoEstablishment,
          'Account Active': 'Active',
          'Activation Date': new Date(),
        };

        await collection.insertOne(newEmployee);
        console.log(`New user ${firstName} ${lastName} added and activated.`);
      } else {
        // Update the existing employee
        const updates = {
          'Phone': Phone,
          'Email': Email,
          'Hire Date': hireDate,
          'Position Status': positionStatus,
          'Home Department': homeDepartment,
          'Job Title': jobTitle,
          'Location': location,
          'Supervisor First Name': supervisorFirstName,
          'Supervisor Last Name': supervisorLastName,
          'Worker Category': workCategory,
          'Pay Category': payCategory,
          'EEOC Establishment': eeoEstablishment,
        };

        if (existingEmployee['Account Active'] !== 'Active') {
          updates['Account Active'] = 'Active';
          updates['Activation Date'] = new Date();
          console.log(`User ${firstName} ${lastName} activated.`);
        } else {
          console.log(`User ${firstName} ${lastName} is already active, updating other details.`);
        }

        await collection.updateOne(filter, { $set: updates });
      }
    }
  } catch (error) {
    console.error('Error handling activating app users to database:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
}

// Function to save a survey to the database
export const saveSurveyToDatabase = async (uniqueId, sender, subject, currentDataTime, surveyQuestionsJSON, recipiantNumber, adminUser, transactionId) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('survey forms');

    await collection.insertOne({ uniqueId, sender, subject, currentDataTime, surveyQuestionsJSON, recipiantNumber, adminUser, transactionId });
    console.log('Survey form saved to database successfully');
  } catch (error) {
    console.error('Error handling saving survey form to database:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
};

// Function to save a notification to the database
export async function saveNotificationToDatabase(sender, subject, messageContent, adminUser, messageId, transactionId) {
  const client = new MongoClient(MONGODB_URI);
  const currentDataTime = Date.now();

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('notifications');

    await collection.insertOne({ sender, subject, currentDataTime, messageContent, adminUser, messageId, transactionId });
    console.log('Notification saved to database successfully');
  } catch (error) {
    console.error('Error handling saving notification to database:', error);
    throw error;
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
}

// Function to update a document in the database
export async function updateDocument(collectionName, filter, updateDoc) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db(database_name);
    const collection = db.collection(collectionName);
    const result = await collection.updateOne(filter, updateDoc);
    console.log(`${result.modifiedCount} document(s) updated`);
    return result;
  } catch (error) {
    console.error('Error during MongoDB operation:', error);
    throw error;
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
}

// Function to insert a document into the database
export async function insertDocument(collectionName, document) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db(database_name);
    const collection = db.collection(collectionName);
    const result = await collection.insertOne(document);
    console.log('Document saved to database successfully');
    return result;
  } catch (error) {
    console.error('Error during MongoDB operation:', error);
    throw error;
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
}

// Function to find a document in the database
export async function findDocument(collectionName, filter) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection(collectionName);
    return await collection.findOne(filter);
  } catch (error) {
    console.error('Error finding document:', error);
    throw error;
  } finally {
    await client.close();
  }
}

export async function deleteDocument(collectionName, filter) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection(collectionName);
    const result = await collection.deleteOne(filter);

    if (result.deletedCount === 0) {
      throw new Error('Employee not found.');
    }

    console.log(`Successfully deleted ${result.deletedCount} document(s).`);
    return result;
  } catch (error) {
    console.error('Error finding document:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Function to add a document to the database
export async function addDocument(collectionName, document) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection(collectionName);
    const result = await collection.insertOne(document);

    console.log(`Successfully inserted document with id: ${result.insertedId}.`);
    return result;
  } catch (error) {
    console.error('Error inserting document:', error);
    throw error;
  } finally {
    await client.close();
  }
}

export async function importEmployeesData(employees) {
  function formatPhoneNumber(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, ''); // Remove non-digit characters
    if (digits.length !== 10) {
      console.warn(`Invalid phone number: ${phone}`);
      return phone; // Return as is if not 10 digits
    }
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  const client = new MongoClient(MONGODB_URI);
  const summary = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    inserted: 0,
    skipped: 0,
  };
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    // Collect all existing usernames for uniqueness
    const existingUsernames = new Set(await collection.distinct('username'));

    for (const employeeData of employees) {
      summary.processed += 1;
      // Support both the payroll roster schema and CSV files exported by App Console.
      const rawPhone = employeeData.Phone;
      const email = employeeData.Email;
      const lastName = employeeData['Last Name'] || employeeData['Payroll Name: Last Name'];
      const firstName = employeeData['First Name'] || employeeData['Payroll Name: First Name'];
      const hireDate = employeeData['Hire Date'] || employeeData['Hire/Rehire Date'];
      const positionStatus = employeeData['Position Status'];
      const homeDepartment = employeeData['Home Department'] || employeeData['Home Department Description'];
      const jobTitle = employeeData['Job Title'] || employeeData['Job Title Description'];
      const location = employeeData.Location || employeeData['Location Description'];
      const workCategory = employeeData['Worker Category'] || employeeData['Worker Category Description'];
      const payCategory = employeeData['Pay Category'] || employeeData['Regular Pay Rate Description'];
      const eeoEstablishment = employeeData['EEOC Establishment'] || employeeData['EEO Establishment'];
      const reportTo = employeeData['Reports To Name'];

      let supervisorFirstName = employeeData['Supervisor First Name'];
      let supervisorLastName = employeeData['Supervisor Last Name'];
      if (reportTo && !supervisorFirstName && !supervisorLastName) {
        const [last = '', first = ''] = reportTo.split(',').map(name => name.trim());
        supervisorFirstName = first;
        supervisorLastName = last;
      }

      const updateDocument = {};
      const setIfProvided = (field, value) => {
        if (value !== undefined && value !== null) updateDocument[field] = value;
      };
      setIfProvided('First Name', firstName);
      setIfProvided('Last Name', lastName);
      if (rawPhone !== undefined) setIfProvided('Phone', formatPhoneNumber(rawPhone));
      setIfProvided('Email', email);
      setIfProvided('Hire Date', hireDate);
      setIfProvided('Position Status', positionStatus);
      setIfProvided('Home Department', homeDepartment);
      setIfProvided('Job Title', jobTitle);
      setIfProvided('Location', location);
      setIfProvided('Supervisor First Name', supervisorFirstName);
      setIfProvided('Supervisor Last Name', supervisorLastName);
      setIfProvided('Worker Category', workCategory);
      setIfProvided('Pay Category', payCategory);
      setIfProvided('EEOC Establishment', eeoEstablishment);

      let existingEmployee = null;
      if (employeeData._id && ObjectId.isValid(employeeData._id)) {
        existingEmployee = await collection.findOne({ _id: new ObjectId(employeeData._id) });
      }
      if (!existingEmployee) {
        const matchOptions = [];
        if (firstName && lastName) matchOptions.push({ 'First Name': firstName, 'Last Name': lastName });
        if (rawPhone) matchOptions.push({ Phone: formatPhoneNumber(rawPhone) });
        if (email) matchOptions.push({ Email: email });
        if (matchOptions.length) existingEmployee = await collection.findOne({ $or: matchOptions });
      }

      if (existingEmployee) {
        const updateResult = await collection.updateOne({ _id: existingEmployee._id }, { $set: updateDocument });
        if (updateResult.modifiedCount > 0) {
          summary.updated += 1;
          console.log(`Updated existing employee: ${firstName} ${lastName}`);
        } else {
          summary.unchanged += 1;
          console.log(`No changes for employee: ${firstName} ${lastName}`);
        }
        continue;
      }

      if (!firstName || !lastName) {
        console.warn('Skipping employee row without a first and last name.');
        summary.skipped += 1;
        continue;
      }

      const generatedUsername = generateUsername(firstName, lastName, existingUsernames);
      existingUsernames.add(generatedUsername);
      const employeeDocument = {
        ...updateDocument,
        username: generatedUsername,
        password: generateRandomCode(),
        isActivated: false,
        'Account Active': 'Active'
      };
      await collection.insertOne(employeeDocument);
      summary.inserted += 1;
      console.log(`Inserted new employee: ${firstName} ${lastName}`);
    }
    return summary;
  } catch (error) {
    console.error('Error processing employee data:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Function to add a new user to the database
export async function addExternalUser(firstName, lastName, password, type, phoneNumber, email) {
  const client = new MongoClient(MONGODB_URI);
  try {
    // Connect to MongoDB
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('external users');

    // Get the distinct userId values
    const usernameSet = new Set(await collection.distinct('userId'));

    // Generate a unique userId
    const userId = generateUsername(firstName, lastName, usernameSet);

    // Insert the user data into the MongoDB collection
    const newUser = {
      firstName,
      lastName,
      userId,
      password,
      type,
      phoneNumber: phoneNumber || '', // Optional field
      email: email || '', // Optional field
      created_at: new Date()
    };

    await collection.insertOne(newUser);
    console.log('User data inserted successfully');
    return true;
  } catch (error) {
    console.error('Error handling user registration:', error.message);
    return false;
  } finally {
    // Close the MongoDB connection
    await client.close();
    console.log('Connection to MongoDB closed');
  }
}

export async function deleteNotificationHistory(transactionId) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('notifications');

    const result = await collection.deleteOne({ transactionId });

    if (result.deletedCount === 1) {
      console.log(`Notification with transaction ID ${transactionId} deleted successfully from MongoDB.`);
    } else {
      console.log(`Notification with transaction ID ${transactionId} not found in MongoDB.`);
    }
  } catch (error) {
    console.error('Error deleting notification from MongoDB:', error.message);
    throw new Error('Failed to delete notification from MongoDB');
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed');
  }
}

export async function addNewEmployee(newEmployee) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    const cleanValue = value => String(value || '').trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
    const normalizedValue = value => cleanValue(value).toLocaleLowerCase();
    const referenceFields = [
      ['homeDepartment', 'Home Department', 'Home Department'],
      ['jobTitle', 'Job Title', 'Job Title'],
      ['location', 'Location', 'Location'],
      ['eeoc', 'EEOC Establishment', 'EEOC'],
      ['workCategory', 'Worker Category', 'Employment Category'],
      ['payCategory', 'Pay Category', 'Pay Category'],
    ];
    const allEmployees = await collection.find({}).toArray();
    const referenceEmployees = allEmployees.filter(employee => String(employee['Account Active'] || '').toLocaleLowerCase() === 'active');
    const newInformation = [];

    for (const [formField, databaseField, label] of referenceFields) {
      const value = cleanValue(newEmployee[formField]);
      const existing = referenceEmployees.map(employee => cleanValue(employee[databaseField])).find(candidate => candidate && normalizedValue(candidate) === normalizedValue(value));
      if (existing) newEmployee[formField] = existing;
      else {
        newEmployee[formField] = value;
        newInformation.push(`${label}: ${value}`);
      }
    }

    const supervisorFirstName = cleanValue(newEmployee.supervisorFirstName);
    const supervisorLastName = cleanValue(newEmployee.supervisorLastName);
    const supervisor = referenceEmployees.flatMap(employee => [
      [employee['Supervisor First Name'], employee['Supervisor Last Name']],
      [employee['First Name'], employee['Last Name']],
    ]).find(([first, last]) => normalizedValue(first) === normalizedValue(supervisorFirstName) && normalizedValue(last) === normalizedValue(supervisorLastName));
    if (supervisor) {
      newEmployee.supervisorFirstName = cleanValue(supervisor[0]);
      newEmployee.supervisorLastName = cleanValue(supervisor[1]);
    } else {
      newEmployee.supervisorFirstName = supervisorFirstName;
      newEmployee.supervisorLastName = supervisorLastName;
      newInformation.push(`Supervisor: ${supervisorFirstName} ${supervisorLastName}`);
    }

    newEmployee.firstName = cleanValue(newEmployee.firstName);
    newEmployee.lastName = cleanValue(newEmployee.lastName);
    newEmployee.email = cleanValue(newEmployee.email);
    if (newInformation.length && newEmployee.approvedNewValues !== true) {
      throw new Error(`Error during operation: New information requires admin confirmation: ${newInformation.join('; ')}`);
    }

    // Ignore superficial formatting when checking for an existing employee.
    const phoneDigits = value => String(value || '').replace(/\D/g, '');
    const duplicateCheck = allEmployees.find(employee => (
      normalizedValue(employee['First Name']) === normalizedValue(newEmployee.firstName)
        && normalizedValue(employee['Last Name']) === normalizedValue(newEmployee.lastName)
    ) || phoneDigits(employee.Phone) === phoneDigits(newEmployee.phone)
      || normalizedValue(employee.Email) === normalizedValue(newEmployee.email));

    if (duplicateCheck) {
      const isInactive = ['inactive', 'terminated'].includes(
        String(duplicateCheck['Account Active'] || duplicateCheck['Position Status'] || '').toLowerCase()
      ) || Boolean(duplicateCheck['Termination Date']);

      if (isInactive) {
        await collection.updateOne(
          { _id: duplicateCheck._id },
          {
            $set: {
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
              "Worker Category": newEmployee.workCategory,
              "Pay Category": newEmployee.payCategory,
              "EEOC Establishment": newEmployee.eeoc,
              "Account Active": "Active",
              "Reactivation Date": new Date(),
            },
          },
        );

        await updateEmployeeToNovuSubscriber({
          'Payroll Name: First Name': newEmployee.firstName,
          'Payroll Name: Last Name': newEmployee.lastName,
          'Email': newEmployee.email,
          'Phone': newEmployee.phone
        });

        return { insertedId: duplicateCheck._id, reactivated: true };
      }

      if (normalizedValue(duplicateCheck.Email) === normalizedValue(newEmployee.email)) {
        throw new Error('Error during operation: Duplicate email found.');
      }
      if (phoneDigits(duplicateCheck.Phone) === phoneDigits(newEmployee.phone)) {
        throw new Error('Error during operation: Duplicate phone number found.');
      }
      throw new Error('Error during operation: Duplicate employee record found.');
    }

    // Check for duplicate username
    const usernameSet = new Set(await collection.distinct('username'));
    const username = generateUsername(newEmployee.firstName, newEmployee.lastName, usernameSet);
    if (usernameSet.has(username)) {
      throw new Error('Error during operation: Duplicate username found.');
    }

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
      "Worker Category": newEmployee.workCategory,
      "Pay Category": newEmployee.payCategory,
      "EEOC Establishment": newEmployee.eeoc,
      "isActivated": 'false',
      "Account Active": "Active",
      username,
      password
    };

    const result = await collection.insertOne(employeeDocument);
    console.log('New employee added:', employeeDocument);

    // Update the new employee to Novu subscriber
    await updateEmployeeToNovuSubscriber({
      'Payroll Name: First Name': newEmployee.firstName,
      'Payroll Name: Last Name': newEmployee.lastName,
      'Email': newEmployee.email,
      'Phone': newEmployee.phone
    });

    return result;
  } catch (error) {
    console.error(error.message);  // Only print the message
    throw error; // Rethrow error to be handled by the caller
  } finally {
    await client.close();
  }
}

