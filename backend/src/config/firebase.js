const path = require('path');
const admin = require('firebase-admin');
const { isProduction } = require('./env');

const getCredential = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
    const serviceAccountPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);
    const serviceAccount = require(serviceAccountPath);
    return admin.credential.cert(serviceAccount);
  }

  return null;
};

try {
  if (!admin.apps.length) {
    const credential = getCredential();

    if (credential) {
      admin.initializeApp({ credential });
      console.log('Firebase Admin initialized successfully');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      console.log('Firebase Admin initialized from GOOGLE_APPLICATION_CREDENTIALS');
    } else if (isProduction) {
      throw new Error(
        'Firebase admin credentials are required in production. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.'
      );
    } else {
      console.warn('Firebase Admin credentials not configured. Firebase auth will be unavailable.');
    }
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error.message);
  if (isProduction) {
    throw error;
  }
}

module.exports = admin;
