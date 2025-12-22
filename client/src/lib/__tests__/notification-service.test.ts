import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
} from 'firebase/firestore';
import { notificationService } from '../notification-service';
import { metricsService } from '../metrics';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})), // Return a mock collection reference
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn((db, collection, id) => ({ id })), // Return a mock document reference with the given id
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  query: vi.fn((...args) => args), // Return the arguments for testing
  where: vi.fn((field, op, value) => ({ field, op, value })), // Return filter object
  orderBy: vi.fn((field, direction) => ({ field, direction })), // Return order object
  limit: vi.fn((num) => ({ limit: num })), // Return limit object
  serverTimestamp: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(),
  })),
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  enableIndexedDbPersistence: vi.fn(() => Promise.resolve()),
  enableMultiTabIndexedDbPersistence: vi.fn(() => Promise.resolve()),
  CACHE_SIZE_UNLIMITED: vi.fn(),
}));

// Mock metrics service
vi.mock('../metrics', () => ({
  metricsService: {
    trackFeatureUsage: vi.fn(),
  },
}));

describe('NotificationService', () => {
  const mockUserId = 'test-user-id';
  const mockNotificationId = 'test-notification-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getPreferences', () => {
    it('should return default preferences when no document exists', async () => {
      const mockDocRef = { id: 'test' };
      const mockGetDoc = vi.fn().mockResolvedValue({
        exists: () => false,
      });

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
        data: () => ({}),
      } as any);
      vi.mocked(setDoc).mockResolvedValue();

      const result = await notificationService.getPreferences(mockUserId);

      expect(result.enabled).toBe(true);
      expect(result.emailEnabled).toBe(true);
      expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.any(Object), { merge: true });
    });

    it('should return merged preferences when document exists', async () => {
      const existingPrefs = {
        enabled: false,
        categories: {
          aiInsights: { enabled: false },
        },
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => existingPrefs,
      } as any);

      const result = await notificationService.getPreferences(mockUserId);

      expect(result.enabled).toBe(false);
      expect(result.categories.aiInsights.enabled).toBe(false);
      expect(result.categories.scheduledMessages.enabled).toBe(true); // default
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(getDoc).mockRejectedValue(new Error('Firestore error'));

      const result = await notificationService.getPreferences(mockUserId);

      expect(result.enabled).toBe(true); // returns defaults on error
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences successfully', async () => {
      const mockDocRef = { id: 'test' };
      const newPrefs = { enabled: false };

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue();

      await notificationService.updatePreferences(mockUserId, newPrefs);

      expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        ...newPrefs,
        lastUpdated: expect.any(String),
      }), { merge: true });
      expect(metricsService.trackFeatureUsage).toHaveBeenCalledWith('notification_preferences_updated');
    });

    it('should handle errors', async () => {
      vi.mocked(setDoc).mockRejectedValue(new Error('Update failed'));

      await expect(notificationService.updatePreferences(mockUserId, { enabled: false }))
        .rejects.toThrow('Update failed');
    });
  });

  describe('create', () => {
    const mockNotificationData = {
      title: 'Test Notification',
      message: 'Test message',
      priority: 'normal' as const,
    };

    it('should create notification when enabled', async () => {
      const mockDocRef = { id: mockNotificationId };
      const mockAddDoc = vi.fn().mockResolvedValue(mockDocRef);

      vi.spyOn(notificationService, 'getPreferences').mockResolvedValue({
        enabled: true,
        emailEnabled: false,
        categories: {
          system: { enabled: true, priority: 'normal' },
        },
      } as any);
      vi.mocked(addDoc).mockResolvedValue(mockDocRef);

      const result = await notificationService.create(mockUserId, 'system-test', mockNotificationData);

      expect(result).toBe(mockNotificationId);
      expect(addDoc).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
        userId: mockUserId,
        type: 'system-test',
        title: 'Test Notification',
        message: 'Test message',
        category: 'system',
      }));
      expect(metricsService.trackFeatureUsage).toHaveBeenCalledWith('notification_created_system-test');
    });

    it('should not create notification when globally disabled', async () => {
      vi.spyOn(notificationService, 'getPreferences').mockResolvedValue({
        enabled: false,
        categories: {},
      } as any);

      const result = await notificationService.create(mockUserId, 'system-test', mockNotificationData);

      expect(result).toBe('');
      expect(addDoc).not.toHaveBeenCalled();
    });

    it('should not create notification when category disabled', async () => {
      vi.spyOn(notificationService, 'getPreferences').mockResolvedValue({
        enabled: true,
        categories: {
          system: { enabled: false },
        },
      } as any);

      const result = await notificationService.create(mockUserId, 'system-test', mockNotificationData);

      expect(result).toBe('');
    });

    it('should send email when enabled', async () => {
      const mockDocRef = { id: mockNotificationId };

      vi.spyOn(notificationService, 'getPreferences').mockResolvedValue({
        enabled: true,
        emailEnabled: true,
        categories: {
          system: { enabled: true },
        },
      } as any);
      vi.mocked(addDoc).mockResolvedValue(mockDocRef);
      vi.mocked(updateDoc).mockResolvedValue();

      await notificationService.create(mockUserId, 'system-test', mockNotificationData);

      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        'channels.email': expect.any(Object),
      }));
    });
  });

  describe('list', () => {
    it('should return empty array when userId is not provided', async () => {
      const result = await notificationService.list('');

      expect(result).toEqual([]);
    });

    it('should list notifications with default options', async () => {
      const mockNotifications = [
        { id: '1', userId: mockUserId, title: 'Test' },
        { id: '2', userId: mockUserId, title: 'Test 2' },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockNotifications.map(n => ({
          id: n.id,
          data: () => n,
        })),
      } as any);

      const result = await notificationService.list(mockUserId);

      expect(result).toEqual(mockNotifications);
    });

    it('should filter unread notifications', async () => {
      const mockNotifications = [
        { id: '1', userId: mockUserId, readAt: null },
        { id: '2', userId: mockUserId, readAt: new Date().toISOString() },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockNotifications[0]].map(n => ({
          id: n.id,
          data: () => n,
        })),
      } as any);

      const result = await notificationService.list(mockUserId, { unreadOnly: true });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by category', async () => {
      const result = await notificationService.list(mockUserId, { category: 'system' });

      // First query call: collection + where(userId) + orderBy
      expect(query).toHaveBeenNthCalledWith(1,
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
      // Second query call: previous query result + where(category)
      expect(query).toHaveBeenNthCalledWith(2,
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should apply limit', async () => {
      const result = await notificationService.list(mockUserId, { limit: 10 });

      // First query call: collection + where(userId) + orderBy
      expect(query).toHaveBeenNthCalledWith(1,
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
      // Second query call: previous query result + limit
      expect(query).toHaveBeenNthCalledWith(2,
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockDocRef = { id: mockNotificationId };

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(updateDoc).mockResolvedValue();

      await notificationService.markAsRead(mockNotificationId);

      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, {
        readAt: expect.any(String),
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(updateDoc).mockRejectedValue(new Error('Update failed'));

      // Should not throw
      await notificationService.markAsRead(mockNotificationId);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const mockNotifications = [
        { id: '1', readAt: null },
        { id: '2', readAt: null },
      ];

      vi.spyOn(notificationService, 'list').mockResolvedValue(mockNotifications);
      vi.mocked(writeBatch).mockReturnValue({
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(),
      } as any);

      await notificationService.markAllAsRead(mockUserId);

      expect(notificationService.list).toHaveBeenCalledWith(mockUserId, { unreadOnly: true });
      expect(writeBatch).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete notification', async () => {
      const mockDocRef = { id: mockNotificationId };

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(deleteDoc).mockResolvedValue();

      await notificationService.delete(mockNotificationId);

      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(deleteDoc).mockRejectedValue(new Error('Delete failed'));

      // Should not throw
      await notificationService.delete(mockNotificationId);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const mockNotifications = [
        { id: '1' },
        { id: '2' },
        { id: '3' },
      ];

      vi.spyOn(notificationService, 'list').mockResolvedValue(mockNotifications);

      const result = await notificationService.getUnreadCount(mockUserId);

      expect(result).toBe(3);
      expect(notificationService.list).toHaveBeenCalledWith(mockUserId, { unreadOnly: true });
    });

    it('should return 0 on error', async () => {
      vi.spyOn(notificationService, 'list').mockRejectedValue(new Error('List failed'));

      const result = await notificationService.getUnreadCount(mockUserId);

      expect(result).toBe(0);
    });
  });
});