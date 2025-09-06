let activeTabId = null;
let activeStartTime = null;
let currentSite = null;
let lastDateCheck = null;

const TRACKED_SITES = {
  'instagram.com': 'instagram',
  'youtube.com': 'youtube',
  'www.youtube.com': 'youtube'
};

const RETENTION_DAYS = 30;
const MAX_EMAIL_ATTEMPTS = 3;
const BATCH_THRESHOLD = 3;

// Helper function to get date string in YYYY-MM-DD format (local time)
function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to get formatted date for display
function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if date has changed since last check
function hasDateChanged() {
  const currentDate = getDateString();
  if (lastDateCheck && lastDateCheck !== currentDate) {
    return true;
  }
  lastDateCheck = currentDate;
  return false;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getSiteFromUrl(url) {
  if (!url) return null;
  for (const [domain, site] of Object.entries(TRACKED_SITES)) {
    if (url.includes(domain)) return site;
  }
  return null;
}

async function updateTracking() {
  // Check for date change
  if (hasDateChanged() && lastDateCheck) {
    console.log('Date changed, checking if report needed for previous day');
    // Add delay to let onStartup handler run first
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Re-check after delay to avoid race condition
    const data = await chrome.storage.local.get(['trackingData']);
    const trackingData = data.trackingData || {};
    const prevDayData = trackingData[lastDateCheck];
    
    if (prevDayData && !prevDayData.emailSent && !prevDayData.emailSendInProgress) {
      console.log('Triggering report for previous day');
      await sendDailyReport(new Date(lastDateCheck + 'T23:59:00'));
    }
  }
  
  const tab = await getCurrentTab();
  
  if (activeStartTime && currentSite) {
    const elapsed = Date.now() - activeStartTime;
    await addTime(currentSite, elapsed);
  }
  
  if (tab && tab.url) {
    const site = getSiteFromUrl(tab.url);
    if (site) {
      activeTabId = tab.id;
      activeStartTime = Date.now();
      currentSite = site;
    } else {
      activeTabId = null;
      activeStartTime = null;
      currentSite = null;
    }
  } else {
    activeTabId = null;
    activeStartTime = null;
    currentSite = null;
  }
}

async function addTime(site, milliseconds) {
  const today = getDateString();
  const data = await chrome.storage.local.get(['trackingData']);
  const trackingData = data.trackingData || {};
  
  // Initialize today's data if it doesn't exist
  if (!trackingData[today]) {
    trackingData[today] = {
      instagram: 0,
      youtube: 0,
      emailSent: false,
      emailAttempts: 0,
      lastAttemptTime: null,
      isPartialDay: false
    };
  }
  
  // Add time to the specific site
  trackingData[today][site] = (trackingData[today][site] || 0) + milliseconds;
  
  // Update current date
  await chrome.storage.local.set({ 
    trackingData,
    currentDate: today
  });
}

// Check for and send any pending reports
async function checkAndSendPendingReports() {
  console.log('Checking for pending reports...');
  
  const data = await chrome.storage.local.get(['trackingData', 'emailConfig']);
  const trackingData = data.trackingData || {};
  const config = data.emailConfig;
  
  if (!config || !config.toEmail1 || !config.serviceId || !config.templateId || !config.publicKey) {
    console.log('Email not configured, skipping pending reports');
    return;
  }
  
  const today = getDateString();
  const pendingDays = [];
  
  // Find all days with pending emails
  for (const [date, dayData] of Object.entries(trackingData)) {
    if (date < today && !dayData.emailSent && dayData.emailAttempts < MAX_EMAIL_ATTEMPTS) {
      pendingDays.push(date);
    }
  }
  
  if (pendingDays.length === 0) {
    console.log('No pending reports found');
    return;
  }
  
  console.log(`Found ${pendingDays.length} pending reports`);
  
  // Sort dates chronologically
  pendingDays.sort();
  
  // Mark all pending emails as in progress to prevent duplicates
  for (const date of pendingDays) {
    trackingData[date].emailSendInProgress = true;
  }
  await chrome.storage.local.set({ trackingData });
  
  // Decide whether to batch or send individually
  if (pendingDays.length > BATCH_THRESHOLD) {
    await sendBatchReport(pendingDays);
  } else {
    for (const date of pendingDays) {
      await sendDailyReport(new Date(date + 'T23:59:00'));
      // Add small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Send a batch report for multiple days
async function sendBatchReport(dates) {
  console.log(`Sending batch report for ${dates.length} days`);
  
  const data = await chrome.storage.local.get(['trackingData', 'emailConfig']);
  const trackingData = data.trackingData || {};
  const config = data.emailConfig;
  
  if (!config || !config.toEmail1) {
    console.log('Email not configured');
    return;
  }
  
  let messageBody = `Daily Usage Summary (${dates.length} days):\n\n`;
  
  for (const date of dates) {
    const dayData = trackingData[date];
    const instagramTime = formatTime(dayData.instagram || 0);
    const youtubeTime = formatTime(dayData.youtube || 0);
    const totalTime = formatTime((dayData.instagram || 0) + (dayData.youtube || 0));
    const formattedDate = formatDateForDisplay(date);
    messageBody += `${formattedDate}: Instagram: ${instagramTime}, YouTube: ${youtubeTime}, Total: ${totalTime}${dayData.isPartialDay ? ' (partial day)' : ''}\n`;
  }
  
  const totalInstagram = dates.reduce((sum, date) => {
    return sum + (trackingData[date].instagram || 0);
  }, 0);
  const totalYoutube = dates.reduce((sum, date) => {
    return sum + (trackingData[date].youtube || 0);
  }, 0);
  const totalTime = totalInstagram + totalYoutube;
  
  messageBody += `\nTotal: Instagram: ${formatTime(totalInstagram)}, YouTube: ${formatTime(totalYoutube)}, Combined: ${formatTime(totalTime)}`;
  
  const emails = [config.toEmail1, config.toEmail2, config.toEmail3].filter(email => email).join(', ');
  
  const emailData = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    template_params: {
      to_email: emails,
      subject: `Vincent Daily Report - Batch (${dates[0]} to ${dates[dates.length - 1]})`,
      message: messageBody
    }
  };
  
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });
    
    if (response.ok) {
      console.log('Batch email sent successfully');
      // Mark all days as sent
      for (const date of dates) {
        trackingData[date].emailSent = true;
        trackingData[date].emailSentTime = new Date().toISOString();
      }
      await chrome.storage.local.set({ trackingData });
    } else {
      console.error('Failed to send batch email');
      // Update attempt counts and clear in-progress flag
      for (const date of dates) {
        trackingData[date].emailAttempts = (trackingData[date].emailAttempts || 0) + 1;
        trackingData[date].lastAttemptTime = new Date().toISOString();
        trackingData[date].emailSendInProgress = false;
      }
      await chrome.storage.local.set({ trackingData });
    }
  } catch (error) {
    console.error('Error sending batch email:', error);
    // Clear in-progress flag on error
    for (const date of dates) {
      trackingData[date].emailSendInProgress = false;
    }
    await chrome.storage.local.set({ trackingData });
  }
}

// Clean up old data
async function cleanupOldData() {
  console.log('Running data cleanup...');
  
  const data = await chrome.storage.local.get(['trackingData']);
  const trackingData = data.trackingData || {};
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffString = getDateString(cutoffDate);
  
  let cleaned = false;
  
  for (const date in trackingData) {
    // Keep data if email not sent or if within retention period
    if (date < cutoffString && trackingData[date].emailSent) {
      delete trackingData[date];
      cleaned = true;
    }
  }
  
  if (cleaned) {
    await chrome.storage.local.set({ 
      trackingData,
      lastCleanupDate: getDateString()
    });
    console.log('Cleanup completed');
  }
}

chrome.tabs.onActivated.addListener(updateTracking);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateTracking();
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (activeStartTime && currentSite) {
      const elapsed = Date.now() - activeStartTime;
      addTime(currentSite, elapsed);
      activeStartTime = null;
      currentSite = null;
    }
  } else {
    updateTracking();
  }
});

// Set up alarms
chrome.alarms.create('dailyReport', {
  when: getNext1159PM(),
  periodInMinutes: 24 * 60
});

chrome.alarms.create('midnightReset', {
  when: getNextMidnight(),
  periodInMinutes: 24 * 60
});

chrome.alarms.create('cleanup', {
  periodInMinutes: 24 * 60
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReport') {
    await sendDailyReport();
  } else if (alarm.name === 'midnightReset') {
    // No longer need to reset since we're using date-based tracking
    // Just check for pending reports
    await checkAndSendPendingReports();
  } else if (alarm.name === 'cleanup') {
    await cleanupOldData();
  }
});

function getNext1159PM() {
  const target = new Date();
  target.setHours(23, 59, 0, 0);
  
  if (new Date() >= target) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime();
}

function getNextMidnight() {
  const target = new Date();
  target.setDate(target.getDate() + 1);
  target.setHours(0, 0, 0, 0);
  return target.getTime();
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

async function sendDailyReport(dateToReport = null) {
  const reportDate = dateToReport ? getDateString(dateToReport) : getDateString();
  console.log(`Sending daily report for ${reportDate}`);
  
  const data = await chrome.storage.local.get(['trackingData', 'emailConfig']);
  const trackingData = data.trackingData || {};
  const config = data.emailConfig;
  
  if (!config || !config.toEmail1 || !config.serviceId || !config.templateId || !config.publicKey) {
    console.log('Email not configured');
    return;
  }
  
  const dayData = trackingData[reportDate];
  
  if (!dayData) {
    console.log(`No data for ${reportDate}`);
    return;
  }
  
  if (dayData.emailSent) {
    console.log(`Email already sent for ${reportDate}`);
    return;
  }
  
  if (dayData.emailAttempts >= MAX_EMAIL_ATTEMPTS) {
    console.log(`Max email attempts reached for ${reportDate}`);
    return;
  }
  
  const instagramTime = formatTime(dayData.instagram || 0);
  const youtubeTime = formatTime(dayData.youtube || 0);
  const totalTime = formatTime((dayData.instagram || 0) + (dayData.youtube || 0));
  const formattedDate = formatDateForDisplay(reportDate);
  
  const emails = [config.toEmail1, config.toEmail2, config.toEmail3].filter(email => email).join(', ');
  
  let message = `Today's usage:\nInstagram: ${instagramTime}\nYouTube: ${youtubeTime}\nTotal: ${totalTime}`;
  if (dayData.isPartialDay) {
    message += '\n(partial day tracking)';
  }
  
  const emailData = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    template_params: {
      to_email: emails,
      subject: `Vincent Daily Report - ${formattedDate}`,
      message: message
    }
  };
  
  // Mark as in progress
  dayData.emailSendInProgress = true;
  await chrome.storage.local.set({ trackingData });
  
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });
    
    if (response.ok) {
      console.log(`Email sent successfully for ${reportDate}`);
      dayData.emailSent = true;
      dayData.emailSentTime = new Date().toISOString();
      dayData.emailSendInProgress = false;
    } else {
      console.error(`Failed to send email for ${reportDate}`);
      dayData.emailAttempts = (dayData.emailAttempts || 0) + 1;
      dayData.lastAttemptTime = new Date().toISOString();
      dayData.emailSendInProgress = false;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    dayData.emailAttempts = (dayData.emailAttempts || 0) + 1;
    dayData.lastAttemptTime = new Date().toISOString();
    dayData.emailSendInProgress = false;
  }
  
  await chrome.storage.local.set({ trackingData });
}

// On startup, check for pending reports and migrate old data if needed
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension starting up...');
  
  // Set initial date check
  lastDateCheck = getDateString();
  
  // Migrate old data format if needed
  await migrateOldData();
  
  // Check for any stuck "in progress" emails
  await clearStuckEmails();
  
  // Check for pending reports
  await checkAndSendPendingReports();
  
  // Run cleanup
  await cleanupOldData();
});

// Also run on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated...');
  
  // Set initial date check
  lastDateCheck = getDateString();
  
  // Migrate old data format if needed
  await migrateOldData();
  
  // Initialize today's tracking if needed
  const today = getDateString();
  const data = await chrome.storage.local.get(['trackingData']);
  const trackingData = data.trackingData || {};
  
  if (!trackingData[today]) {
    trackingData[today] = {
      instagram: 0,
      youtube: 0,
      emailSent: false,
      emailAttempts: 0,
      lastAttemptTime: null,
      isPartialDay: true // Mark as partial since extension was just installed
    };
    
    await chrome.storage.local.set({
      trackingData,
      currentDate: today
    });
  }
});

// Migrate old data format to new structure
async function migrateOldData() {
  const data = await chrome.storage.local.get(['dailyTime', 'trackingData']);
  
  if (data.dailyTime && !data.trackingData) {
    console.log('Migrating old data format...');
    
    const today = getDateString();
    const trackingData = {
      [today]: {
        instagram: data.dailyTime.instagram || 0,
        youtube: data.dailyTime.youtube || 0,
        emailSent: false,
        emailAttempts: 0,
        lastAttemptTime: null,
        isPartialDay: false
      }
    };
    
    await chrome.storage.local.set({ trackingData });
    await chrome.storage.local.remove(['dailyTime']);
    
    console.log('Migration completed');
  }
}

// Clear any stuck "in progress" emails
async function clearStuckEmails() {
  const data = await chrome.storage.local.get(['trackingData']);
  const trackingData = data.trackingData || {};
  
  let updated = false;
  
  for (const dayData of Object.values(trackingData)) {
    if (dayData.emailSendInProgress) {
      // Clear flag if it's been more than 60 seconds
      const lastAttempt = dayData.lastAttemptTime ? new Date(dayData.lastAttemptTime) : null;
      if (!lastAttempt || (Date.now() - lastAttempt.getTime()) > 60000) {
        dayData.emailSendInProgress = false;
        updated = true;
      }
    }
  }
  
  if (updated) {
    await chrome.storage.local.set({ trackingData });
  }
}

// Update tracking every second
setInterval(updateTracking, 1000);

// Export for manual triggers from popup
chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === 'sendPendingReports') {
    checkAndSendPendingReports().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
});