import { MongoClient, ObjectId } from 'mongodb';

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;
const MONGODB_URI = `mongodb+srv://${username}:${password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;

export async function generateAndSaveUsernames() {
  const generateRandomCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    const employees = await collection.find({ username: { $exists: true } }).toArray();
    // const usernameSet = new Set(await collection.distinct('username'));
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

async function addNewEmployee(firstName, lastName) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(database_name);
    const collection = db.collection('employees');

    const usernameSet = new Set(await collection.distinct('username'));
    const username = generateUsername(firstName, lastName, usernameSet);

    const newEmployee = { firstName, lastName, username };
    await collection.insertOne(newEmployee);
    console.log('New employee added:', newEmployee);
  } catch (error) {
    console.error('Failed to add new employee:', error);
  } finally {
    await client.close();
  }
}

export const saveEventToDatabase = async (eventData) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    // Access the database
    const db = client.db(database_name);
    const collection = db.collection('events');

    // Parse dates
    const startDate = new Date(eventData.startDate);
    const endDate = new Date(eventData.endDate);
    const allDay = eventData.allDay;
    const creator = eventData.creator;
    const location = eventData.location;
    const title = eventData.title;

    // Adjust start and end dates for all-day events to include the whole day
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
      allDay: allDay === 'true'
    };

    // Insert the survey data into the MongoDB collection
    await collection.insertOne(event);
    console.log('Event form saved to database successfully');
  } catch (error) {
    console.error('Error handling saving Event form to database:', error.message);
    throw error; // Rethrow to handle in the calling function
  } finally {
    // Close the MongoDB connection
    await client.close();
    console.log('Connection to MongoDB closed');
  }
}

export const saveSurveyToDatabase = async (uniqueId, sender, subject, currentDataTime, surveyQuestionsJSON, recipiantNumber) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    // Access the database
    const db = client.db(database_name);
    const collection = db.collection('survey forms');

    // Insert the survey data into the MongoDB collection
    await collection.insertOne({ uniqueId, sender, subject, currentDataTime, surveyQuestionsJSON, recipiantNumber });
    console.log('Survey form saved to database successfully');
  } catch (error) {
    console.error('Error handling saving survey form to database:', error.message);
    throw error; // Rethrow to handle in the calling function
  } finally {
    // Close the MongoDB connection
    await client.close();
    console.log('Connection to MongoDB closed');
  }
};

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
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const collectionName = 'employees';
    const db = client.db(database_name);
    const collection = db.collection(collectionName);

    for (const employeeData of employees) {
      const employeeId = employeeData._id;
      delete employeeData._id; // Remove _id from data to avoid errors on update

      // Check if there is an existing document with the same _id
      const existingEmployee = await collection.findOne({ _id: new ObjectId(employeeId) });

      if (existingEmployee) {
        // Compare each field for changes
        const updates = {};
        let needsUpdate = false;

        for (const key in employeeData) {
          if (employeeData[key] !== existingEmployee[key]) {
            updates[key] = employeeData[key];
            needsUpdate = true;
          }
        }

        // If there are changes, update the document
        if (needsUpdate || existingEmployee) {
          const updatesForUnset = {};

          // Determine fields to unset
          Object.keys(existingEmployee).forEach((key) => {
            // If the key is not present in the new data and it's not '_id', mark it for removal
            if (!employeeData.hasOwnProperty(key) && key !== '_id') {
              updatesForUnset[key] = ""; // The value doesn't matter; $unset just needs the key
            }
          });

          // Combine $set and $unset updates
          const combinedUpdates = {};
          if (needsUpdate) {
            combinedUpdates.$set = updates;

            if (Object.keys(updatesForUnset).length > 0) {
              combinedUpdates.$unset = updatesForUnset;
            }

            // Execute the update with both $set and $unset as needed
            await collection.updateOne(
              { _id: new ObjectId(employeeId) },
              combinedUpdates
            );
            console.log(`Employee ${employeeId} updated.`);
          }
        }
      } else {
        // If no existing document found, create a new one
        await collection.insertOne({
          ...employeeData,
          _id: new ObjectId(employeeId), // Reassign _id to ensure consistency
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