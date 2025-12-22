/**
 * Notification Service
 * 
 * Handles notification creation, delivery, preferences, and smart logic
 * Built with psychological principles for optimal engagement without annoyance
 */

import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { 
  Notification, 
  NotificationPreferences, 
  NotificationType, 
  DEFAULT_NOTIFICATION_PREFERENCES,
  QUIET_HOURS_PRESETS,
  NotificationChannel,
} from "./notification-types";
import { metricsService } from "./metrics";

const NOTIFICATIONS_COLLECTION = "notifications";
const NOTIFICATION_PREFERENCES_COLLECTION = "notificationPreferences";

class NotificationService {
  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const docRef = doc(db, NOTIFICATION_PREFERENCES_COLLECTION, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const existingData = docSnap.data();
        
        // Merge existing data with defaults to ensure all fields exist
        // This handles migration from old schema to new schema
        const mergedPreferences: NotificationPreferences = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...existingData,
          // Ensure nested objects are properly merged
          digest: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.digest,
            ...(existingData.digest || {}),
          },
          categories: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
            ...(existingData.categories || {}),
            // Merge each category to preserve nested settings
            aiInsights: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.categories.aiInsights,
              ...(existingData.categories?.aiInsights || {}),
              insightTypes: {
                ...DEFAULT_NOTIFICATION_PREFERENCES.categories.aiInsights.insightTypes,
                ...(existingData.categories?.aiInsights?.insightTypes || {}),
              },
            },
            scheduledMessages: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.categories.scheduledMessages,
              ...(existingData.categories?.scheduledMessages || {}),
              reminders: {
                ...DEFAULT_NOTIFICATION_PREFERENCES.categories.scheduledMessages.reminders,
                ...(existingData.categories?.scheduledMessages?.reminders || {}),
              },
            },
            contactActivity: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.categories.contactActivity,
              ...(existingData.categories?.contactActivity || {}),
            },
            system: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.categories.system,
              ...(existingData.categories?.system || {}),
            },
            social: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.categories.social,
              ...(existingData.categories?.social || {}),
            },
          },
        };
        
        return mergedPreferences;
      }
      
      // Initialize with defaults for new users
      await this.updatePreferences(userId, DEFAULT_NOTIFICATION_PREFERENCES);
      return DEFAULT_NOTIFICATION_PREFERENCES;
    } catch (error) {
      console.error('[NotificationService] Error getting preferences:', error);
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userId: string, 
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      const docRef = doc(db, NOTIFICATION_PREFERENCES_COLLECTION, userId);
      const updatedPreferences = {
        ...preferences,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('[NotificationService] Updating preferences for user:', userId);
      console.log('[NotificationService] Updates:', updatedPreferences);
      
      // Use setDoc with merge to create or update
      await setDoc(docRef, updatedPreferences, { merge: true });
      
      console.log('[NotificationService] Preferences updated successfully');
      await metricsService.trackFeatureUsage('notification_preferences_updated');
    } catch (error) {
      console.error('[NotificationService] Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Create and send a notification
   */
  async create(
    userId: string,
    type: NotificationType,
    data: {
      title: string;
      message: string;
      icon?: string;
      image?: string;
      actionUrl?: string;
      actionLabel?: string;
      priority?: Notification['priority'];
      contextData?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      // Get user preferences
      const preferences = await this.getPreferences(userId);
      
      // Check if notifications are enabled globally
      if (!preferences.enabled) {
        console.log('[NotificationService] Notifications disabled for user');
        return '';
      }

      // Determine category and settings
      const category = this.getCategoryFromType(type);
      const categorySettings = preferences.categories[category];
      
      // Check if this category is enabled
      if (!categorySettings.enabled) {
        console.log(`[NotificationService] Category ${category} disabled for user`);
        return '';
      }

      // Create notification document
      const notification: Omit<Notification, 'id'> = {
        userId,
        type,
        title: data.title,
        message: data.message,
        icon: data.icon,
        image: data.image,
        priority: data.priority || categorySettings.priority,
        category,
        createdAt: new Date().toISOString(),
        actionUrl: data.actionUrl,
        actionLabel: data.actionLabel,
        dismissible: data.priority !== 'urgent',
        channels: {},
        data: data.contextData,
      };

      // Save to database
      const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), notification);

      // Send email if enabled
      if (preferences.emailEnabled) {
        await this.sendEmail(docRef.id, notification, preferences);
      }

      // Track metric
      await metricsService.trackFeatureUsage(`notification_created_${type}`);

      return docRef.id;
    } catch (error) {
      console.error('[NotificationService] Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  async list(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      category?: string;
    } = {}
  ): Promise<Notification[]> {
    try {
      if (!userId) {
        console.error('[NotificationService] Cannot list notifications: userId is required');
        return [];
      }

      const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
      let q = query(
        notificationsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      if (options.unreadOnly) {
        q = query(q, where("readAt", "==", null));
      }

      if (options.category) {
        q = query(q, where("category", "==", options.category));
      }

      if (options.limit) {
        q = query(q, firestoreLimit(options.limit));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
    } catch (error) {
      console.error('[NotificationService] Error listing notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
      await updateDoc(docRef, {
        readAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[NotificationService] Error marking as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const notifications = await this.list(userId, { unreadOnly: true });
      const batch = writeBatch(db);
      
      notifications.forEach(notification => {
        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
        batch.update(docRef, { readAt: new Date().toISOString() });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('[NotificationService] Error marking all as read:', error);
    }
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
    } catch (error) {
      console.error('[NotificationService] Error deleting notification:', error);
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const notifications = await this.list(userId, { unreadOnly: true });
      return notifications.length;
    } catch (error) {
      console.error('[NotificationService] Error getting unread count:', error);
      return 0;
    }
  }

  // === Private Helper Methods ===

  /**
   * Determine category from notification type
   */
  private getCategoryFromType(type: NotificationType): keyof NotificationPreferences['categories'] {
    if (type.startsWith('ai-')) return 'aiInsights';
    if (type.startsWith('schedule-')) return 'scheduledMessages';
    if (type.startsWith('contact-')) return 'contactActivity';
    if (type.startsWith('system-')) return 'system';
    if (type.startsWith('social-')) return 'social';
    return 'system'; // fallback
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    notificationId: string,
    notification: Omit<Notification, 'id'>,
    preferences: NotificationPreferences
  ): Promise<void> {
    const updates: Record<string, any> = {};

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    updates['channels.email'] = {
      sent: true,
      sentAt: new Date().toISOString(),
    };
    console.log('[NotificationService] Would send email:', notification.title);

    // Update notification with channel delivery info
    if (Object.keys(updates).length > 0) {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
      await updateDoc(docRef, updates);
    }
  }
}

export const notificationService = new NotificationService();
