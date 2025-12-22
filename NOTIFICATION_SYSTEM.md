# Notification System Integration Guide

## Overview

The ContactHub notification system is a world-class, psychology-driven notification engine designed to maximize engagement without overwhelming users. This guide shows how to integrate notifications throughout the app.

## Key Features

✅ **Granular Control** - Users control every aspect of notifications
✅ **Smart Defaults** - Works great out of the box
✅ **Quiet Hours** - Respects user's focus time
✅ **Digest Mode** - Batches non-urgent notifications
✅ **Multi-Channel** - Email, Push, In-App, SMS
✅ **Category-Based** - Organized by context
✅ **Priority Levels** - Urgent alerts bypass quiet hours

## Quick Start

### 1. Send a Notification

```typescript
import { notificationService } from '@/lib/notification-service';

// AI Insight notification
await notificationService.create(userId, 'ai-relationship-health', {
  title: "You haven't contacted Sarah in 3 months",
  message: "She mentioned her wedding is next week. Perfect time to reach out!",
  icon: "👰",
  actionUrl: "/contacts?highlight=sarah-id",
  actionLabel: "View Contact",
  priority: "medium",
  contextData: {
    contactId: "sarah-id",
    lastContactDate: "2024-09-20",
  },
});

// Schedule reminder
await notificationService.create(userId, 'schedule-reminder-hour', {
  title: "Birthday message scheduled in 1 hour",
  message: "Group: 'Family' - Message will be sent at 3:00 PM",
  actionUrl: "/groups/family-id",
  actionLabel: "View Group",
  priority: "high",
});

// Celebration notification
await notificationService.create(userId, 'ai-celebration', {
  title: "🎉 5 birthdays this week!",
  message: "Don't forget to reach out to: John, Sarah, Mike, Lisa, Tom",
  actionUrl: "/insights",
  actionLabel: "See All",
  priority: "medium",
});
```

### 2. Integration Points

#### When AI Generates Insights
```typescript
// In contact-hub-ai.ts or wherever AI insights are generated
const insight = await ContactHubAI.analyzeRelationshipHealth(contact);

if (insight.needsAttention) {
  await notificationService.create(userId, 'ai-relationship-health', {
    title: `Relationship health: ${contact.name}`,
    message: insight.recommendation,
    actionUrl: `/contacts?highlight=${contact.id}`,
    actionLabel: "View Contact",
    priority: "medium",
  });
}
```

#### When Contacts Are Imported
```typescript
// After successful import
await notificationService.create(userId, 'contact-import-complete', {
  title: "Contacts imported successfully",
  message: `${importedCount} contacts from Google Contacts are now in your hub`,
  actionUrl: "/contacts",
  actionLabel: "View Contacts",
  priority: "low",
});
```

#### When Schedules Are About to Send
```typescript
// 24 hours before
await notificationService.create(userId, 'schedule-reminder-day', {
  title: "Message scheduled for tomorrow",
  message: `Group: '${group.name}' - ${schedule.message.substring(0, 50)}...`,
  actionUrl: `/groups/${group.id}`,
  actionLabel: "Review Message",
  priority: "medium",
});

// 1 hour before
await notificationService.create(userId, 'schedule-reminder-hour', {
  title: "Message sending in 1 hour",
  message: `Group: '${group.name}' - ${recipientCount} recipients`,
  actionUrl: `/groups/${group.id}`,
  actionLabel: "Cancel or Edit",
  priority: "high",
});
```

#### When Messages Are Sent
```typescript
// Success notification
await notificationService.create(userId, 'schedule-sent', {
  title: "Messages sent successfully",
  message: `${successCount} messages delivered to ${group.name}`,
  actionUrl: "/logs",
  actionLabel: "View Logs",
  priority: "medium",
});

// Failure notification
if (failureCount > 0) {
  await notificationService.create(userId, 'schedule-failed', {
    title: "Some messages failed to send",
    message: `${failureCount} messages failed for ${group.name}`,
    actionUrl: "/logs",
    actionLabel: "View Errors",
    priority: "high",
  });
}
```

#### When Users Hit Milestones
```typescript
// Achievement unlocked
await notificationService.create(userId, 'social-achievement', {
  title: "🏆 Achievement Unlocked!",
  message: "You've stayed in touch with 50 people this month",
  priority: "low",
});

// Milestone reached
await notificationService.create(userId, 'social-milestone', {
  title: "100 contacts organized!",
  message: "You're building meaningful relationships. Keep it up!",
  priority: "low",
});
```

## Notification Types

### AI Insights Category
- `ai-relationship-health` - Contacts you haven't reached out to
- `ai-smart-suggestion` - Perfect timing to connect
- `ai-contact-pattern` - Behavioral insights
- `ai-celebration` - Birthdays, anniversaries, special days

### Scheduled Messages Category
- `schedule-reminder-day` - 24 hours before sending
- `schedule-reminder-hour` - 1 hour before sending
- `schedule-sent` - Message successfully delivered
- `schedule-failed` - Message delivery failed

### Contact Activity Category
- `contact-new` - New contact added
- `contact-import-complete` - Bulk import finished
- `contact-bulk-action` - Bulk delete/update confirmation

### System & Account Category
- `system-security` - Security alerts (always sent)
- `system-billing` - Payment/subscription updates
- `system-update` - New features available
- `system-tip` - Helpful tips and onboarding

### Social & Achievements Category
- `social-achievement` - Goals achieved
- `social-milestone` - Usage milestones
- `social-referral` - Friend joined via referral

## Priority Levels

- **urgent** - Bypasses quiet hours (security, critical failures)
- **high** - Important but can wait (payment issues, schedule reminders)
- **medium** - Standard priority (AI insights, confirmations)
- **low** - Nice to know (tips, achievements, milestones)

## Best Practices

### ✅ DO

- **Be specific**: "Sarah's birthday is tomorrow" not "Upcoming event"
- **Add context**: Include who, what, when, why
- **Provide actions**: Deep link to relevant page
- **Use emojis sparingly**: Only for celebrations/achievements
- **Batch similar notifications**: Don't spam users
- **Respect quiet hours**: Use appropriate priorities
- **Test user flow**: Ensure action URLs work

### ❌ DON'T

- **Over-notify**: More ≠ better. Quality > quantity
- **Use jargon**: Speak human, not robot
- **Skip action URLs**: Users want to act immediately
- **Ignore preferences**: Respect user's channel choices
- **Send duplicates**: Check if similar notification exists
- **Use vague messages**: "Something happened" = bad
- **Forget to track**: Use contextData for analytics

## Advanced: Digest Mode

Users can enable digest mode to batch less urgent notifications:

```typescript
// Check if notification should be added to digest
const prefs = await notificationService.getPreferences(userId);
const category = notificationService.getCategoryFromType(notificationType);

if (prefs.digest.enabled && 
    prefs.digest.includeTypes.includes(notificationType) &&
    categorySettings.priority !== 'urgent') {
  // Add to digest queue instead of sending immediately
  // TODO: Implement digest queue system
}
```

## Monitoring & Analytics

Track notification effectiveness:

```typescript
import { metricsService } from '@/lib/metrics';

// Track when notifications are created
await metricsService.trackFeatureUsage(`notification_created_${type}`);

// Track when users click actions
await metricsService.trackFeatureUsage('notification_action_clicked', {
  notificationType: type,
  actionUrl: actionUrl,
});

// Track when users update preferences
await metricsService.trackFeatureUsage('notification_preferences_updated', {
  changesType: 'quiet_hours_enabled',
});
```

## Monetization Integration

### Free Tier Limits
```typescript
const FREE_INSIGHTS_PER_MONTH = 10;

// Check usage before sending AI insights
const insightCount = await getMonthlyInsightCount(userId);

if (insightCount >= FREE_INSIGHTS_PER_MONTH && !user.isPro) {
  // Send upgrade prompt instead
  await notificationService.create(userId, 'system-update', {
    title: "You've used all 10 free insights this month",
    message: "Upgrade to PRO for unlimited AI insights and unlock 10x more discoveries",
    actionUrl: "/settings?tab=billing&action=upgrade",
    actionLabel: "Upgrade to PRO",
    priority: "medium",
  });
} else {
  // Send actual insight
  await notificationService.create(userId, 'ai-relationship-health', {
    title: insight.title,
    message: insight.message,
    // ...
  });
}
```

## UI Components

### Notification Bell (Header)
Already integrated in `layout.tsx`. Shows unread count and quick preview.

### Notification Center (Full Page)
Route: `/notifications`
Component: `<NotificationCenter />`

### Notification Settings
Route: `/settings?tab=notifications`
Component: `<NotificationSettings />`

## Firebase Rules

Add to `firestore.rules`:

```javascript
// Notification preferences (user-specific)
match /notificationPreferences/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// Notifications (user-specific)
match /notifications/{notificationId} {
  allow read: if request.auth != null && 
              request.auth.uid == resource.data.userId;
  allow write: if request.auth != null && 
               request.auth.uid == request.resource.data.userId;
  allow delete: if request.auth != null && 
                request.auth.uid == resource.data.userId;
}
```

## Future Enhancements

1. **Email Templates** - Beautiful HTML email notifications
2. **Push Notifications** - Firebase Cloud Messaging integration
3. **SMS Notifications** - Twilio integration
4. **Digest Queue** - Background job to send daily summaries
5. **Notification History** - Archive after 30 days
6. **Smart Timing** - ML-based send time optimization
7. **A/B Testing** - Test notification copy and timing
8. **Unsubscribe Links** - One-click category disable

---

Built with ❤️ by the most brilliant minds on the planet 🧠✨
