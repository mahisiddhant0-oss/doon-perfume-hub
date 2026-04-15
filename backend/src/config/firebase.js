const path = require('path');
const admin = require('firebase-admin');

// Ensure you have FIREBASE_SERVICE_ACCOUNT_KEY in your .env
// This should be the absolute path to your firebase-adminsdk.json file
// OR you can use environment variables to define the credentials directly
// For development, we'll try initializing it if the credential exists.

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
    const serviceAccountPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin Initialized Successfully');
  } else {
    // If not using a service account key file, fallback to default (assumes GOOGLE_APPLICATION_CREDENTIALS is set)
    // Avoid crashing immediately so the rest of the app can boot, but auth will fail.
    console.warn('WARNING: FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set in .env');
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error.message);
}

module.exports = admin;
