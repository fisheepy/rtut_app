import { MongoClient, ServerApiVersion } from 'mongodb';

const database_username = process.env.MONGODB_USERNAME;
const database_password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;

const uri = `mongodb+srv://${database_username}:${database_password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;

async function main() {
  const firstName = process.argv[2] || 'Xuan';
  const lastName = process.argv[3] || 'Yu';
  const companyEmail = process.argv[4] || 'myu@royaltrailersales.com';
  const testEmail = process.argv[5] || 'yang.y.wl@gmail.com';

  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });

  try {
    await client.connect();
    const db = client.db(database_name);
    const result = await db.collection('admins').updateOne(
      { 'First Name': firstName, 'Last Name': lastName },
      {
        $set: {
          Email: companyEmail,
          'Google Email': companyEmail,
          'Test Google Email': testEmail,
          'Allowed Google Emails': [companyEmail, testEmail],
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount !== 1) {
      throw new Error(`Admin not found: ${firstName} ${lastName}`);
    }

    console.log(`Updated Google emails for ${firstName} ${lastName}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
