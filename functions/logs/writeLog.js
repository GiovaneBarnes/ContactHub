const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Function to log message sending
exports.writeLog = functions.firestore
  .document('messageLogs/{logId}')
  .onCreate((snap, context) => {
    const newValue = snap.data();
    console.log('New message log created:', newValue);
    
    // Perform any post-logging aggregation or notification here
    return null;
  });
