import { MongoClient, ObjectId } from 'mongodb';

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

// Function to generate and save usernames for all employees
export async function generateAndSaveUsernames() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    const employees = await collection.find({ username: { $exists: true } }).toArray();
    const usernameSet = new Set();

    for (const employee of employees) {
      let username = generateUsername(employee['First Name'], employee['Last Name'], usernameSet);
      usernameSet.add(username);
      let password = generateRandomCode();
      await collection.updateOne({ _id: employee._id }, { $set: { username, password } });
    }
  } catch (error) {
    console.error('Failed to update usernames:', error);
  } finally {
    await client.close();
  }
}

// Function to add a new employee and generate username and password
export async function addNewEmployee(firstName, lastName) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    const usernameSet = new Set(await collection.distinct('username'));
    const username = generateUsername(firstName, lastName, usernameSet);
    const password = generateRandomCode();

    const newEmployee = { firstName, lastName, username, password };
    await collection.insertOne(newEmployee);
    console.log('New employee added:', newEmployee);
    return newEmployee;
  } catch (error) {
    console.error('Failed to add new employee:', error);
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

    const startDate = new Date(eventData.startDate);
    const endDate = new Date(eventData.endDate);
    const allDay = eventData.allDay;
    const creator = eventData.creator;
    const location = eventData.location;
    const title = eventData.title;
    const detail = eventData.detail;

    if (allDay === 'true') {
      startDate.setUTCHours(0, 0, 0, 0);
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

// Function to save a survey to the database
export const saveSurveyToDatabase = async (uniqueId, sender, subject, currentDataTime, surveyQuestionsJSON, recipiantNumber, transactionId) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('survey forms');

    await collection.insertOne({ uniqueId, sender, subject, currentDataTime, surveyQuestionsJSON, recipiantNumber, transactionId });
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
export async function saveNotificationToDatabase(sender, subject, messageContent, messageId, transactionId) {
  const client = new MongoClient(MONGODB_URI);
  const currentDataTime = Date.now();

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('notifications');

    await collection.insertOne({ sender, subject, currentDataTime, messageContent, messageId, transactionId });
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

// Function to delete a document from the database
export async function deleteDocument(collectionName, filter) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection(collectionName);
    const result = await collection.deleteOne(filter);

    if (result.deletedCount === 1) {
      console.log(`Successfully deleted one document.`);
    } else {
      console.log("No documents matched the query. Deleted 0 documents.");
    }
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

// Function to import employee data into the database
export async function importEmployeesData(employees) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const collectionName = 'employees';
    const db = client.db(database_name);
    const collection = db.collection(collectionName);

    for (const employeeData of employees) {
      const employeeId = employeeData._id;
      delete employeeData._id;

      const existingEmployee = await collection.findOne({ _id: new ObjectId(employeeId) });

      if (existingEmployee) {
        const updates = {};
        let needsUpdate = false;

        // Only prepare updates for fields that exist in employeeData and differ from existingEmployee
        for (const key in employeeData) {
          if (employeeData[key] !== existingEmployee[key]) {
            updates[key] = employeeData[key];
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await collection.updateOne(
            { _id: new ObjectId(employeeId) },
            { $set: updates }
          );
          console.log(`Employee ${employeeId} updated.`);
        }
      } else {
        await collection.insertOne({
          ...employeeData,
          _id: new ObjectId(employeeId),
        });
        console.log(`Employee ${employeeId} created.`);
      }
    }
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