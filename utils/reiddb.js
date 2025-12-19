const { MongoClient } = require('mongodb');

let db = null;
let client = null;

async function connectToReIDDatabase() {
  if (db) {
    return db;
  }

  const uri = process.env.REID_MONGODB_URI;
  if (!uri) {
    throw new Error('REID_MONGODB_URI environment variable is not set');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();

    // Extract database name from URI or use default
    const dbName = uri.split('/').pop().split('?')[0] || 'historian';
    db = client.db(dbName);

    console.log(`Connected to MongoDB`);
    console.log(`Using database: ${dbName}`);
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

function getReIDDatabase() {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase first.');
  }
  return db;
}

async function closeReIDDatabase() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

module.exports = {
  connectToReIDDatabase,
  getReIDDatabase,
  closeReIDDatabase
};

