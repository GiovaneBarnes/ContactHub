import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Archive user data before account deletion
export const archiveUserData = onCall(async (request) => {
  // Verify user is authenticated
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated to archive data'
    );
  }

  const userId = request.data.userId || request.auth.uid;

  // Verify the user is deleting their own account
  if (userId !== request.auth.uid) {
    throw new HttpsError(
      'permission-denied',
      'Users can only archive their own data'
    );
  }

  try {
    const db = admin.firestore();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    
    // Create archive document
    const archiveRef = db.collection('archived_users').doc(userId);
    
    // Fetch all user data
    const [contacts, groups, logs] = await Promise.all([
      db.collection('contacts').where('userId', '==', userId).get(),
      db.collection('groups').where('userId', '==', userId).get(),
      db.collection('messageLogs').where('userId', '==', userId).get(),
    ]);

    // Prepare archived data
    const archivedData = {
      userId,
      userEmail: request.auth.token.email || 'unknown',
      archivedAt: timestamp,
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days retention
      ),
      contacts: contacts.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      groups: groups.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      messageLogs: logs.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      reason: 'user_requested_deletion',
    };

    // Store archived data
    await archiveRef.set(archivedData);

    // Delete active data
    const batch = db.batch();
    
    contacts.docs.forEach(doc => batch.delete(doc.ref));
    groups.docs.forEach(doc => batch.delete(doc.ref));
    logs.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();

    // console.log(`User data archived for ${userId}. Will be deleted after 90 days.`);

    return {
      success: true,
      archivedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      message: 'Data archived successfully. Will be permanently deleted after 90 days.',
    };
  } catch (error) {
    console.error('Error archiving user data:', error);
    throw new HttpsError(
      'internal',
      'Failed to archive user data',
      error
    );
  }
});

// Scheduled function to clean up expired archives (runs daily)
export const cleanupExpiredArchives = onSchedule('every 24 hours', async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  try {
    const expiredArchives = await db
      .collection('archived_users')
      .where('expiresAt', '<=', now)
      .get();

    if (expiredArchives.empty) {
      // console.log('No expired archives to clean up');
      return;
    }

    const batch = db.batch();
    expiredArchives.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    // console.log(`Cleaned up ${expiredArchives.size} expired user archives`);
  } catch (error) {
    console.error('Error cleaning up expired archives:', error);
    throw error;
  }
});
