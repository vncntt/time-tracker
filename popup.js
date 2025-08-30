// Helper functions
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

function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (dateString === getDateString(today)) {
    return 'Today';
  } else if (dateString === getDateString(yesterday)) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

// Update today's stats
async function updateTodayStats() {
  const today = getDateString();
  const data = await chrome.storage.local.get(['trackingData']);
  const trackingData = data.trackingData || {};
  const todayData = trackingData[today] || { instagram: 0 };
  
  document.getElementById('todayTime').textContent = formatTime(todayData.instagram || 0);
  document.getElementById('todayDate').textContent = formatDateForDisplay(today);
}

// Update history display
async function updateHistory() {
  const data = await chrome.storage.local.get(['trackingData']);
  const trackingData = data.trackingData || {};
  
  // Get last 7 days
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(getDateString(date));
  }
  
  // Check for pending reports
  let pendingCount = 0;
  const historyHTML = dates.map(date => {
    const dayData = trackingData[date] || { instagram: 0, emailSent: false };
    
    if (!dayData.emailSent && date < getDateString() && dayData.instagram > 0) {
      pendingCount++;
    }
    
    let statusBadge = '';
    if (date === getDateString()) {
      statusBadge = '<span class="status-badge status-partial">tracking</span>';
    } else if (dayData.emailSent) {
      statusBadge = '<span class="status-badge status-sent">sent</span>';
    } else if (dayData.emailAttempts >= 3) {
      statusBadge = '<span class="status-badge status-failed">failed</span>';
    } else if (dayData.instagram > 0) {
      statusBadge = '<span class="status-badge status-pending">pending</span>';
    } else {
      statusBadge = '<span class="status-badge status-partial">no data</span>';
    }
    
    return `
      <div class="history-item">
        <span class="date">${formatDateForDisplay(date)}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="time">${formatTime(dayData.instagram || 0)}</span>
          ${statusBadge}
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('historyList').innerHTML = historyHTML;
  
  // Update pending alert
  if (pendingCount > 0) {
    document.getElementById('pendingAlert').style.display = 'block';
    document.getElementById('pendingCount').textContent = pendingCount;
  } else {
    document.getElementById('pendingAlert').style.display = 'none';
  }
}

// Load email settings
async function loadSettings() {
  const data = await chrome.storage.local.get(['emailConfig']);
  if (data.emailConfig) {
    document.getElementById('toEmail1').value = data.emailConfig.toEmail1 || '';
    document.getElementById('toEmail2').value = data.emailConfig.toEmail2 || '';
    document.getElementById('toEmail3').value = data.emailConfig.toEmail3 || '';
    document.getElementById('serviceId').value = data.emailConfig.serviceId || '';
    document.getElementById('templateId').value = data.emailConfig.templateId || '';
    document.getElementById('publicKey').value = data.emailConfig.publicKey || '';
  }
}

// Show status message
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = type;
  
  setTimeout(() => {
    statusEl.className = '';
    statusEl.textContent = '';
  }, 3000);
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  updateTodayStats();
  updateHistory();
  
  // Update stats every second
  setInterval(() => {
    updateTodayStats();
    updateHistory();
  }, 1000);
  
  // Collapsible sections
  document.querySelectorAll('.collapsible').forEach(element => {
    element.addEventListener('click', function() {
      this.classList.toggle('active');
      const content = this.nextElementSibling;
      content.classList.toggle('show');
    });
  });
  
  // Open history by default
  document.querySelector('.collapsible').click();
  
  // Save settings button
  document.getElementById('save').addEventListener('click', async () => {
    const config = {
      toEmail1: document.getElementById('toEmail1').value,
      toEmail2: document.getElementById('toEmail2').value,
      toEmail3: document.getElementById('toEmail3').value,
      serviceId: document.getElementById('serviceId').value,
      templateId: document.getElementById('templateId').value,
      publicKey: document.getElementById('publicKey').value
    };
    
    if (!config.toEmail1 || !config.serviceId || !config.templateId || !config.publicKey) {
      showStatus('Please fill in all required fields', 'error');
      return;
    }
    
    await chrome.storage.local.set({ emailConfig: config });
    showStatus('Settings saved successfully!', 'success');
  });
  
  // Test email button
  document.getElementById('test').addEventListener('click', async () => {
    const today = getDateString();
    const data = await chrome.storage.local.get(['trackingData', 'emailConfig']);
    const trackingData = data.trackingData || {};
    const todayData = trackingData[today] || { instagram: 0 };
    const config = data.emailConfig;
    
    if (!config || !config.toEmail1 || !config.serviceId || !config.templateId || !config.publicKey) {
      showStatus('Please configure email settings first', 'error');
      return;
    }
    
    const instagramTime = formatTime(todayData.instagram || 0);
    
    showStatus('Sending test email...', 'info');
    
    const emails = [config.toEmail1, config.toEmail2, config.toEmail3].filter(email => email).join(', ');
    
    const emailData = {
      service_id: config.serviceId,
      template_id: config.templateId,
      user_id: config.publicKey,
      template_params: {
        to_email: emails,
        subject: `Vincent Instagram Report (TEST)`,
        message: `Today's Instagram usage: ${instagramTime}\n\nThis is a test email from your tracking extension.`
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
        showStatus('Test email sent successfully!', 'success');
      } else {
        showStatus('Failed to send test email', 'error');
      }
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  });
  
  // Send pending reports button
  document.getElementById('sendPending').addEventListener('click', async () => {
    showStatus('Sending pending reports...', 'info');
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'sendPendingReports' });
      
      if (response && response.success) {
        showStatus('Pending reports sent!', 'success');
        // Refresh the display
        setTimeout(() => {
          updateHistory();
        }, 1000);
      } else {
        showStatus('Failed to send reports: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  });
});