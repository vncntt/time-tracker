# Instagram Time Tracker

Chrome extension that tracks daily Instagram usage and automatically emails a report at 11:59 PM.

## Setup

1. **Load Extension**
   - Open `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" → select this folder

2. **Configure EmailJS** (5 mins)
   - Sign up at [emailjs.com](https://emailjs.com)
   - Add Gmail service
   - Create template with: `{{to_email}}`, `{{subject}}`, `{{message}}`
   - Copy credentials to extension popup

3. **Set Recipients**
   - Click extension icon
   - Enter up to 3 email addresses
   - Paste EmailJS credentials
   - Save settings

## Features

### Core Functionality
- Tracks time on instagram.com automatically
- Sends daily report at 11:59 PM
- Test button to verify email setup

### Robust Email Delivery System (New!)
- **Never Lose Data**: All tracking data is stored persistently until email is successfully sent
- **Automatic Recovery**: If Chrome is closed at 11:59 PM, the email will be sent the next time Chrome opens
- **Date-Based Storage**: Each day's data is stored separately with email status tracking
- **Batch Reports**: If more than 3 days are pending, sends a single summary email
- **Retry Logic**: Failed emails automatically retry up to 3 times
- **Manual Send**: Click "Send Now" button in popup to manually trigger pending reports

### Data Management
- **7-Day History View**: See your usage for the past week with email status badges
- **Status Indicators**:
  - `TRACKING` - Currently tracking today's usage
  - `SENT` - Email successfully sent
  - `PENDING` - Email waiting to be sent
  - `FAILED` - Email failed after 3 attempts
  - `NO DATA` - No Instagram usage that day
- **Auto-Cleanup**: Old sent reports are automatically removed after 30 days
- **Partial Day Tracking**: Accurately tracks even if extension is installed mid-day

### Smart Detection
- **Date Change Detection**: Automatically sends report when date changes while Chrome is running
- **Startup Checks**: On Chrome startup, checks for any unsent reports
- **Crash Recovery**: Handles Chrome crashes during email sending

## Email Format

### Individual Daily Report
```
Subject: Vincent Daily Instagram Report - Aug 30
Body: Today's Instagram usage: 2h 34m
```

### Batch Report (Multiple Days)
```
Subject: Vincent Instagram Report - Batch (2025-08-25 to 2025-08-29)
Body: 
Instagram Usage Summary (5 days):

Aug 25: 1h 23m
Aug 26: 2h 15m
Aug 27: 45m
Aug 28: 3h 10m
Aug 29: 1h 55m

Total: 9h 28m
```

## How It Works

1. **Primary Scenario**: If Chrome is open at 11:59 PM, email sends automatically
2. **Recovery Scenario**: If Chrome was closed, pending emails send on next Chrome startup
3. **Manual Trigger**: Use "Send Now" button in popup to send pending reports immediately

## Data Structure

The extension uses a date-based storage system:
```javascript
{
  trackingData: {
    "2025-08-30": {
      instagram: 12345,        // milliseconds
      emailSent: false,         // email status
      emailAttempts: 0,         // retry count
      lastAttemptTime: null,    // last attempt timestamp
      isPartialDay: false       // partial day indicator
    }
  }
}
```

## Troubleshooting

- **Emails not sending**: Check EmailJS credentials in popup settings
- **Pending reports**: Click "Send Now" button to manually trigger
- **Data not tracking**: Ensure you're on instagram.com (not the mobile app)
- **Multiple pending days**: Extension will batch them into one email if > 3 days