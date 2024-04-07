import { deleteDocument } from './mongodbUtilities.mjs';

const deleteEmployee = async (firstName, lastName) => {
    try {
      const filter = { "First Name": `${firstName}`, "Last Name": `${lastName}` };
      const result = await deleteDocument('employees', filter);
      
      console.log(`${result} document(s) deleted`);
      return result;
    } catch (error) {
      console.error('Error during MongoDB operation:', error);
      throw error;
    } finally {
      console.log('Connection to MongoDB closed');
    }
}

// Check if command-line arguments are provided
if (process.argv.length < 4) {
    console.error('Usage: node deleteEmployee.mjs <firstName> <lastName>');
    process.exit(1);
}

// Extract command-line arguments
const firstName = process.argv[2];
const lastName = process.argv[3];

// Call the function to send notifications
deleteEmployee(firstName,lastName);
