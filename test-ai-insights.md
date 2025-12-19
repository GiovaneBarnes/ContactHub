# AI Insights Troubleshooting Guide

## What We Fixed

### 1. **Critical Data Structure Issue** ✅✅ 
**Problem**: Queries were looking for a `contactId` field that doesn't exist at the top level of messageLogs
**Root Cause**: MessageLogs are for GROUP messages, not individual contacts. The contact info is in the `recipientDetails` array
**Solution**: Changed all AI insight queries to:
1. Fetch ALL messageLogs for the user
2. Filter logs where `recipientDetails` array contains the specific `contactId`
3. This accurately finds all messages sent to that contact

### 2. **Missing Firestore Index** ✅
**Problem**: Queries for `messageLogs` with `userId` + `contactId` + `timestamp` were failing
**Solution**: Simplified to only need `userId` + `timestamp` index (already exists)
**Note**: We now filter in-memory on recipientDetails, which is more accurate

### 3. **Auto-Update Last Contact Date** ✅
**Problem**: Contact's `lastContact` field wasn't being updated when messages were sent
**Solution**: After sending messages, automatically update `lastContact` for all successfully contacted recipients

### 4. **Enhanced Error Logging** ✅
**Problem**: Errors were silent, making debugging impossible
**Solution**: Added comprehensive console logging to:
- `firebase-api.ts` - All AI functions now log their progress AND show filtering results
- `contact-insights-drawer.tsx` - Query functions now log success/failure
- Specific error messages displayed in UI

### 3. **Query Retry Logic** ✅
**Problem**: Transient failures weren't being retried
**Solution**: Added retry configuration to all TanStack Query calls:
```typescript
retry: 2,
retryDelay: 1000,
```

### 4. **Better Error Messages** ✅
**Problem**: Generic error messages didn't help diagnose issues
**Solution**: Display specific error messages for each AI insight type in the drawer

## How to Test

### Step 1: Check Browser Console
1. Open the app: https://contacthub-29950.web.app
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Click on a contact to open AI insights
5. Look for log messages:
   - 🔍 Fetching messages indicate start of operations
   - ✅ Success messages indicate completion
   - ❌ Error messages indicate failures

### Step 2: Check Firestore Indexes
1. Go to: https://console.firebase.google.com/project/contacthub-29950/firestore/indexes
2. Verify the new index for `messageLogs` is **Enabled** (not building)
3. If building, wait 2-5 minutes for completion

### Step 3: Test Each AI Feature
Open a contact and verify these load:
- **Relationship Briefing** (Summary)
- **Communication Intelligence** (Patterns)
- **Optimal Contact Times** (Timing)

### Step 4: Check Function Logs
```bash
firebase functions:log | grep -E "(analyzeCommunicationPatterns|suggestContactTime|generateContactSummary)"
```

## Common Issues & Solutions

### Issue: "Index Required" Error
**Symptom**: Error mentions composite index needed
**Solution**: 
1. Check if index is still building in Firebase Console
2. Wait for index to complete (shows green checkmark)
3. Refresh the page

### Issue: "Contact not found"
**Symptom**: AI insights show error about missing contact
**Solution**:
1. Verify contact exists in Firestore
2. Check that contact has correct `userId` field
3. Ensure user is authenticated

### Issue: Functions Timing Out
**Symptom**: Requests take >30 seconds
**Solution**:
1. Check Firebase Functions quotas
2. Verify Gemini AI API is enabled
3. Check function logs for detailed errors

### Issue: Fallback Data Showing
**Symptom**: Generic messages like "AI analysis temporarily unavailable"
**Solution**:
1. This is expected behavior when functions fail
2. Check function logs for root cause
3. Verify Firebase Functions are deployed correctly

## Monitoring Checklist

✅ Firestore index deployed and enabled
✅ Console logs showing query execution
✅ Error messages are specific and helpful
✅ Retry logic is working (check Network tab)
✅ Functions are responding within timeout
✅ Browser console shows detailed debug info

## Architecture Overview

```
Contact Insights Flow:
1. User clicks contact → Opens drawer
2. Drawer triggers 3 parallel queries:
   - generateContactSummary
   - analyzeCommunicationPatterns  
   - suggestContactTime
3. Each query:
   a. Fetches contact from Firestore
   b. Queries messageLogs (needs composite index!)
   c. Calls Firebase Function with data
   d. Function calls Gemini AI
   e. Returns structured response
4. Results displayed in drawer or fallback shown
```

## Debug Commands

```bash
# Watch function logs in real-time
firebase functions:log --only analyzeCommunicationPatterns

# Check recent errors
firebase functions:log | grep -i "error"

# Verify index status
firebase firestore:indexes

# Test a specific function
curl -X POST https://us-central1-contacthub-29950.cloudfunctions.net/analyzeCommunicationPatterns \
  -H "Authorization: Bearer $(firebase auth:token)" \
  -H "Content-Type: application/json" \
  -d '{"contactId": "YOUR_CONTACT_ID"}'
```

## Next Steps if Still Failing

1. **Check Gemini AI Quota**: Ensure you haven't hit API limits
2. **Verify Authentication**: Confirm user tokens are valid
3. **Test with Sample Data**: Create a new contact with message logs
4. **Check Network Tab**: Look for 403/401 errors indicating auth issues
5. **Review Function Code**: Ensure all required fields are present

## Success Indicators

When working correctly, you should see:
- ✅ All 3 AI sections load within 5 seconds
- ✅ Specific, contextual insights about the contact
- ✅ No error alerts in the drawer
- ✅ Console shows successful completion logs
- ✅ Refresh button works to reload insights
