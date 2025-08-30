let activeTabId = null;
let activeStartTime = null;
let currentSite = null;

const TRACKED_SITES = {
  'instagram.com': 'instagram'
};

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
  const data = await chrome.storage.local.get(['dailyTime']);
  const dailyTime = data.dailyTime || { instagram: 0 };
  dailyTime[site] = (dailyTime[site] || 0) + milliseconds;
  await chrome.storage.local.set({ dailyTime });
}

chrome.tabs.onActivated.addListener(updateTracking);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
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

chrome.alarms.create('dailyReport', {
  when: getNext1159PM(),
  periodInMinutes: 24 * 60
});

chrome.alarms.create('midnightReset', {
  when: getNextMidnight(),
  periodInMinutes: 24 * 60
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReport') {
    await sendDailyReport();
  } else if (alarm.name === 'midnightReset') {
    await chrome.storage.local.set({ dailyTime: { instagram: 0 } });
  }
});

function getNext1159PM() {
  const now = new Date();
  const target = new Date();
  target.setHours(23, 59, 0, 0);
  
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime();
}

function getNextMidnight() {
  const now = new Date();
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

async function sendDailyReport() {
  const data = await chrome.storage.local.get(['dailyTime', 'emailConfig']);
  const dailyTime = data.dailyTime || { instagram: 0 };
  const config = data.emailConfig;
  
  if (!config || !config.toEmail1 || !config.serviceId || !config.templateId || !config.publicKey) {
    console.log('Email not configured');
    return;
  }
  
  const instagramTime = formatTime(dailyTime.instagram || 0);
  
  // Combine emails, filtering out empty ones
  const emails = [config.toEmail1, config.toEmail2].filter(email => email).join(', ');
  
  const emailData = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    template_params: {
      to_email: emails,
      subject: `Vincent Daily Instagram Report`,
      message: `Today's Instagram usage: ${instagramTime}`
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
      console.log('Email sent successfully');
    } else {
      console.error('Failed to send email');
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

setInterval(updateTracking, 1000);