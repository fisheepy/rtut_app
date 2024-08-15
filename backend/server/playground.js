/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('rtut-app-server');

// Update multiple documents where the 'First Name' is 'Xuan'
db.getCollection('employees')
  .updateOne(
    {
        'First Name': 'Yang'
    },
    {
        $set: {
            // 'isActivated': 'false' // Set the value of 'someField' to 'newValue'
        }
    }
  );
