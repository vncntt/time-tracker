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
   - Enter up to 2 email addresses
   - Paste EmailJS credentials
   - Save settings

## Features

- Tracks time on instagram.com automatically
- Sends daily report at 11:59 PM
- Resets counter at midnight
- Test button to verify email setup

## Email Format
```
Subject: Vincent Daily Instagram Report
Body: Today's Instagram usage: 2h 34m
```