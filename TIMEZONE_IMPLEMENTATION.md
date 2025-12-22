# Timezone Implementation Plan

## ✅ Phase 1: Foundation (COMPLETED)

### Installed Dependencies
- ✅ `date-fns-tz` - Timezone-aware date manipulation library

### Created Core Utilities (`/client/src/lib/timezone-utils.ts`)
- ✅ `getUserTimezone()` - Auto-detect browser timezone
- ✅ `getTimezoneAbbreviation()` - Get friendly timezone labels (PST, EST, etc.)
- ✅ `formatInUserTimezone()` - Format dates in user's timezone
- ✅ `formatWithTimezone()` - Display dates with timezone indicators
- ✅ `convertTimezone()` - Convert between timezones
- ✅ `createTimezoneAwareISO()` - Create properly zoned ISO strings
- ✅ `parseToUserTimezone()` - Parse ISO to user timezone
- ✅ `getNowInUserTimezone()` - Get current time in user's timezone
- ✅ `formatScheduleTime()` - Display schedule times with context
- ✅ `hasScheduleTimePassed()` - Check if schedule time has passed
- ✅ `getDateTimeInputBounds()` - Get min/max for date/time inputs
- ✅ `formatRelativeTime()` - Timezone-aware relative times
- ✅ `getCommonTimezones()` - List of common timezones for selection

### Updated Data Models
- ✅ Added `timezone` to User interface
- ✅ Contact already has `timezone` field

### Updated Auth Flow
- ✅ Detect and store user timezone on signup
- ✅ Load user timezone from Firestore on login
- ✅ Auto-populate timezone if missing
- ✅ Store timezone in Firestore `users/{userId}` collection

---

## 🔄 Phase 2: Update Scheduling (TODO)

### Dashboard Message Scheduling
**File**: `/client/src/pages/dashboard.tsx`
**Current Issues**:
- Line 191: `new Date(\`\${scheduledDate}T\${scheduledTime}\`)` - Uses local browser time
- Line 197-198: Stores date/time without timezone context

**Required Changes**:
```typescript
import { createTimezoneAwareISO, formatScheduleTime } from '@/lib/timezone-utils';

// In handleSendMessage():
const scheduleDateTime = createTimezoneAwareISO(
  scheduledDate, 
  scheduledTime, 
  user.timezone || getUserTimezone()
);

const schedule = {
  id: Math.random().toString(36).substr(2, 9),
  type: 'one-time' as const,
  name: messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : ''),
  message: messageContent,
  startDate: scheduleDateTime, // Store full ISO with timezone
  startTime: scheduledTime,
  timezone: user.timezone || getUserTimezone(), // Store timezone
  enabled: true
};
```

### Group Detail Scheduling
**File**: `/client/src/pages/group-detail.tsx`
**Current Issues**:
- Line 133-139: Schedule comparison uses naive Date objects
- Line 162: Date formatting doesn't consider timezone

**Required Changes**:
```typescript
import { hasScheduleTimePassed, formatScheduleTime, parseToUserTimezone } from '@/lib/timezone-utils';

// Update schedule filtering:
const upcomingSchedules = group.schedules.filter(schedule => {
  if (!schedule.enabled) return false;
  return !hasScheduleTimePassed(
    schedule.startDate,
    schedule.startTime || '00:00',
    user.timezone
  );
});

// Update display:
const getScheduleDescription = (schedule: Schedule) => {
  return formatScheduleTime(
    schedule.startDate,
    schedule.startTime,
    user.timezone
  );
};
```

### Upcoming Schedules Component
**File**: `/client/src/components/upcoming-schedules.tsx`
**Required**: Full rewrite to use timezone utilities

---

## 🔄 Phase 3: Update Time Displays (TODO)

### Dashboard Activity Feed
**File**: `/client/src/pages/dashboard.tsx`
**Lines**: 552
```typescript
import { formatWithTimezone } from '@/lib/timezone-utils';

// Replace:
{new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString()}

// With:
{formatWithTimezone(log.timestamp, user?.timezone)}
```

### Logs Page
**File**: `/client/src/pages/logs.tsx`
**Lines**: 77, 124
```typescript
import { formatWithTimezone } from '@/lib/timezone-utils';

// Replace all instances of:
{new Date(log.timestamp).toLocaleString()}

// With:
{formatWithTimezone(log.timestamp, user?.timezone)}
```

### Analytics Page
**File**: `/client/src/pages/analytics.tsx`
**Current Issues**:
- Lines 56, 97, 107, 391: All date operations use local time
- Need to aggregate data by user's timezone, not browser timezone

### Notifications
**File**: `/client/src/components/notification-center.tsx`
**File**: `/client/src/components/notification-bell.tsx`
**Current**: Uses formatDistanceToNow
**Update**: Use our `formatRelativeTime()` with timezone

---

## 🔄 Phase 4: AI & Scheduling Intelligence (TODO)

### Contact Hub AI
**File**: `/client/src/lib/contact-hub-ai.ts`
**Current**: Already has timezone parameter (line 135, 343)
**Update**: Ensure all AI functions receive user.timezone

### Firebase Functions
**File**: `/functions/src/index.ts`
**Lines**: 441+, 927+
**Current**: Has timezone-aware prompts
**Update**: Ensure all function calls pass user timezone from client

### Schedule Manager Component
**File**: `/client/src/components/schedule-manager.tsx`
**Required**: Review and update all date/time handling

---

## 🔄 Phase 5: User Settings (TODO)

### Add Timezone Selector to Settings
**File**: `/client/src/pages/settings.tsx`

```typescript
import { getCommonTimezones, getUserTimezone, isValidTimezone } from '@/lib/timezone-utils';

// Add new card in Account tab:
<Card className="glass hover-lift">
  <CardHeader>
    <div className="flex items-center gap-2">
      <Clock className="h-5 w-5 text-primary" />
      <CardTitle>Timezone</CardTitle>
    </div>
    <CardDescription>
      Set your timezone for accurate scheduling
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="timezone">Your Timezone</Label>
      <Select value={userTimezone} onValueChange={handleTimezoneChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent>
          {getCommonTimezones().map(tz => (
            <SelectItem key={tz.value} value={tz.value}>
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Detected: {getUserTimezone()}
      </p>
    </div>
  </CardContent>
</Card>
```

---

## 🔄 Phase 6: Notification Digest Times (TODO)

### Notification Types
**File**: `/client/src/lib/notification-types.ts`
**Current**: Hard-coded times (08:00, 12:00, etc.)
**Issue**: These are not timezone-aware

**Update**: Add timezone context to digest scheduling
```typescript
export interface NotificationPreferences {
  // ... existing fields
  timezone?: string; // User's timezone for digest delivery
  digest: {
    enabled: boolean;
    time: DigestTime;
    timezone: string; // Make explicit
    daysOfWeek: number[];
    includeTypes: NotificationType[];
  };
}
```

---

## 🔄 Phase 7: Date/Time Inputs (TODO)

### Update All Date/Time Inputs
Search for:
- `<Input type="date" />`
- `<Input type="time" />`

Update with:
```typescript
const { minDate, minTime } = getDateTimeInputBounds(user?.timezone);

<Input 
  type="date"
  min={minDate}
  // ... other props
/>
```

---

## 🎯 Priority Order

### HIGH PRIORITY (User-Facing Scheduling)
1. ✅ Core utilities (DONE)
2. ✅ Auth flow with timezone detection (DONE)
3. 🔄 Dashboard message scheduling
4. 🔄 Group detail scheduling
5. 🔄 Upcoming schedules component
6. 🔄 Settings page timezone selector

### MEDIUM PRIORITY (Display & UX)
7. 🔄 All time displays (logs, dashboard, analytics)
8. 🔄 Notification center time displays
9. 🔄 Date/time input constraints

### LOW PRIORITY (Background/AI)
10. 🔄 AI scheduling suggestions
11. 🔄 Notification digest timing
12. 🔄 Analytics timezone aggregation

---

## Testing Checklist

### Manual Testing
- [ ] Sign up new user - verify timezone auto-detected and stored
- [ ] Schedule a message - verify time stored with timezone
- [ ] View scheduled message - verify displayed in correct timezone
- [ ] Change timezone in settings - verify all times update
- [ ] View logs - verify timestamps show in user timezone
- [ ] Test with different timezones (PST, EST, GMT, JST)
- [ ] Test edge cases (daylight saving transitions)

### Automated Testing
- [ ] Unit tests for timezone utilities
- [ ] Integration tests for scheduling with timezones
- [ ] E2E tests for timezone-aware workflows

---

## Migration Strategy

### For Existing Users
1. Detect and store timezone on next login (handled in auth-context)
2. Existing schedules without timezone:
   - Assume they were created in browser's local time
   - Add migration script to add timezone to old schedules
   - Or: On first load, prompt user to confirm timezone for old schedules

### For Existing Schedules
```typescript
// In firebase-api or data loading:
const migrateSchedules = async (userId: string, userTimezone: string) => {
  const groups = await getGroups(userId);
  
  for (const group of groups) {
    const updated = group.schedules.map(schedule => {
      if (!schedule.timezone) {
        return {
          ...schedule,
          timezone: userTimezone, // Assume user's current timezone
        };
      }
      return schedule;
    });
    
    if (updated.some((s, i) => s !== group.schedules[i])) {
      await updateGroup(group.id, { schedules: updated });
    }
  }
};
```

---

## API Changes Required

### Schedule Interface Update
```typescript
export interface Schedule {
  id: string;
  type: 'one-time' | 'recurring';
  name?: string;
  startDate: string; // ISO 8601 with timezone
  startTime?: string; // HH:mm format
  timezone: string; // IANA timezone identifier
  endDate?: string;
  frequency?: {
    // ... existing fields
  };
  message?: string;
  enabled: boolean;
}
```

---

## Next Immediate Steps

1. **Test Current Implementation**
   ```bash
   npm run check
   npm run build
   firebase deploy
   ```

2. **Verify Timezone Detection**
   - Sign up new user
   - Check Firestore `users/{userId}` for timezone field
   - Verify timezone loads correctly on login

3. **Update Dashboard Scheduling (Priority #1)**
   - Implement the changes in dashboard.tsx
   - Test scheduling a message
   - Verify schedule appears with correct timezone

4. **Add Settings UI (Priority #2)**
   - Add timezone selector to settings
   - Allow user to manually override detected timezone
   - Store changes in Firestore

5. **Update All Time Displays (Priority #3)**
   - Search and replace all date display logic
   - Use timezone utilities consistently
   - Test in different timezones

---

## Resources

### Date-fns-tz Documentation
https://github.com/marnusw/date-fns-tz

### IANA Timezone Database
https://www.iana.org/time-zones

### Timezone Best Practices
- Always store dates in ISO 8601 format with timezone
- Always store the timezone separately for reference
- Convert to user's timezone only for display
- Never use `new Date()` without timezone context
- Test daylight saving transitions
