import { MongoClient } from 'mongodb';

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;
const MONGODB_URI = `mongodb+srv://${username}:${password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;

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

export async function saveNotificationToDatabase(sender, subject, messageContent) {
  const client = new MongoClient(MONGODB_URI);
  const currentDataTime = Date.now();

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(database_name);
    const collection = db.collection('notifications');

    await collection.insertOne({ sender, subject, currentDataTime, messageContent });
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