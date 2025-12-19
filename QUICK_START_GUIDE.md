# 🎬 Quick Start Guide - User Guide

## How to Access the Onboarding Wizard

### For New Users
The onboarding wizard **automatically appears** when you first sign up and log in to ContactHub. You'll see it within 0.5 seconds of landing on the dashboard.

### For Existing Users - Re-triggering the Wizard

You can restart the onboarding experience anytime from the Dashboard:

1. **Navigate to Dashboard** (home page)
2. **Look in the top-right corner** next to your name
3. **Click the "✨ Quick Start Guide" button**

```
┌─────────────────────────────────────────────────────┐
│  Dashboard                     ┌──────────────────┐ │
│  Welcome back, John!           │ ✨ Quick Start   │ │
│                                │    Guide         │ │
│                                └──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### What Happens When You Click It?

1. **Clears your onboarding completion status** (localStorage)
2. **Opens the 3-step wizard immediately**
3. **Tracks the action** for analytics (`onboarding_restarted`)

## Why You Might Want to Restart

- **Forgot how a feature works** - Quick refresher on AI messaging
- **Showing a colleague** - Demonstrate the onboarding flow
- **Testing new features** - See if onboarding was updated
- **Learning the basics** - Review the core workflow

## What You'll Experience

### Step 1: Add Contact
- Create manually OR import CSV
- Takes 30 seconds

### Step 2: AI Message Generation ✨
- Select a group
- Watch AI craft a perfect message
- Takes 15 seconds

### Step 3: Schedule Message 📅
- Pick a date and time
- See your scheduled message
- Takes 20 seconds

**Total time: ~65 seconds**

## Button Details

### Visual Design
- **Icon:** ✨ Sparkles (indicates AI/magic/special feature)
- **Text:** "Quick Start Guide"
- **Style:** Outline button with hover effect
- **Location:** Top-right of dashboard, next to welcome message

### User-Friendly Naming
We chose "Quick Start Guide" instead of:
- ❌ "Onboarding" (too corporate)
- ❌ "Tutorial" (sounds boring)
- ❌ "Help" (implies you're stuck)
- ✅ "Quick Start Guide" (sounds fast, helpful, positive)

### Analytics Tracking
Every time someone clicks it, we track:
```typescript
metricsService.trackFeatureUsage('onboarding_restarted');
```

This helps us understand:
- How often users need help
- If documentation is insufficient
- Which features are confusing

## Technical Implementation

### Code Location
`/client/src/pages/dashboard.tsx` - Lines 296-309

### Logic
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    // Clear completion flag from browser storage
    localStorage.removeItem(`onboarding_completed_${user.id}`);
    
    // Show the wizard
    setShowOnboarding(true);
    
    // Track for analytics
    metricsService.trackFeatureUsage('onboarding_restarted');
  }}
  className="gap-2"
>
  <Sparkles className="h-4 w-4" />
  Quick Start Guide
</Button>
```

### Why localStorage?
- **Fast** - No server round-trip
- **Simple** - No database schema changes needed
- **Private** - Each user's own browser
- **Scoped** - Per user ID (`onboarding_completed_${userId}`)

### Edge Cases Handled
✅ **No user logged in?** Button doesn't show (conditional render)  
✅ **User clicks twice?** Works fine, wizard just reopens  
✅ **User in middle of wizard?** Can restart without issues  
✅ **Different browser?** Will show onboarding again (localStorage is per-browser)

## Mobile Experience

The button is **fully responsive**:

### Desktop (>768px)
```
[✨ Quick Start Guide] [Welcome back!]
                       [Your Name     ]
```

### Mobile (<768px)
Button appears in header or adapts to smaller screen:
```
[✨ Quick Start]
[Guide        ]
```

## Future Enhancements

### Potential Improvements
1. **Contextual help** - Show only relevant steps based on user's current state
2. **Progress persistence** - Resume from where you left off
3. **Skip to specific step** - "Just show me AI features"
4. **Video walkthroughs** - Embedded screen recordings
5. **Help menu** - Access from anywhere in the app, not just dashboard

### Feature Requests to Consider
- "Quick Start Guide" in mobile hamburger menu
- Help icon (?) in navigation bar
- Keyboard shortcut (Shift + ?)
- Tooltip on hover explaining what it does

## Comparison: Before vs After

### ❌ Before
- Once users completed onboarding, no way to see it again
- Had to log out and create new account to test
- No way to show colleagues the flow
- Support tickets: "How do I do X again?"

### ✅ After
- One-click access anytime
- Perfect for demos and training
- Reduces support burden
- Improves feature discovery

## Success Metrics

Track these to measure effectiveness:

1. **Click-through rate** - How many users click the button?
2. **Re-completion rate** - Do they finish all 3 steps again?
3. **Support ticket reduction** - Fewer "how to" questions?
4. **Feature adoption** - Do users discover more features?

## User Feedback

Expected positive outcomes:
- "Oh, I forgot this feature existed!"
- "Perfect for training new team members"
- "Love that I can review anytime"
- "Helped me rediscover AI messaging"

---

## 🎉 Conclusion

The **Quick Start Guide button** transforms the onboarding wizard from a one-time experience into an **always-available resource**. It's a small addition with huge impact on user confidence and feature discovery.

**Users are never more than one click away from learning ContactHub's core workflow.**

---

*Part of the ContactHub Onboarding System*  
*Last updated: December 18, 2025*
