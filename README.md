# Instagram/Youtube Time Tracker

Chrome extension that tracks daily Instagram and YouTube usage and automatically emails a report at 11:59 PM.

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
- Tracks time on instagram.com and youtube.com automatically
- Sends daily report at 11:59 PM with both platform statistics
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
Subject: Vincent Daily Report - Aug 30
Body: Today's usage:
Instagram: 2h 34m
YouTube: 1h 45m
Total: 4h 19m
```

### Batch Report (Multiple Days)
```
Subject: Vincent Report - Batch (2025-08-25 to 2025-08-29)
Body: 
Social Media Usage Summary (5 days):

Aug 25: Instagram: 1h 23m, YouTube: 2h 10m, Total: 3h 33m
Aug 26: Instagram: 2h 15m, YouTube: 45m, Total: 3h 0m
Aug 27: Instagram: 45m, YouTube: 1h 30m, Total: 2h 15m
Aug 28: Instagram: 3h 10m, YouTube: 2h 5m, Total: 5h 15m
Aug 29: Instagram: 1h 55m, YouTube: 3h 20m, Total: 5h 15m

Total: Instagram: 9h 28m, YouTube: 9h 50m, Combined: 19h 18m
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
      youtube: 67890,          // milliseconds
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
- **Data not tracking**: Ensure you're on instagram.com or youtube.com (not mobile apps)
- **Multiple pending days**: Extension will batch them into one email if > 3 days