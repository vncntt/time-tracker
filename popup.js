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

async function updateTimes() {
  const data = await chrome.storage.local.get(['dailyTime']);
  const dailyTime = data.dailyTime || { instagram: 0 };
  
  document.getElementById('instagram').textContent = formatTime(dailyTime.instagram || 0);
}

async function loadSettings() {
  const data = await chrome.storage.local.get(['emailConfig']);
  if (data.emailConfig) {
    document.getElementById('toEmail1').value = data.emailConfig.toEmail1 || '';
    document.getElementById('toEmail2').value = data.emailConfig.toEmail2 || '';
    document.getElementById('serviceId').value = data.emailConfig.serviceId || '';
    document.getElementById('templateId').value = data.emailConfig.templateId || '';
    document.getElementById('publicKey').value = data.emailConfig.publicKey || '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  updateTimes();
  setInterval(updateTimes, 1000);
  
  document.getElementById('save').addEventListener('click', async () => {
    const config = {
      toEmail1: document.getElementById('toEmail1').value,
      toEmail2: document.getElementById('toEmail2').value,
      serviceId: document.getElementById('serviceId').value,
      templateId: document.getElementById('templateId').value,
      publicKey: document.getElementById('publicKey').value
    };
    
    await chrome.storage.local.set({ emailConfig: config });
    document.getElementById('status').textContent = 'Settings saved!';
    setTimeout(() => {
      document.getElementById('status').textContent = '';
    }, 2000);
  });
  
  document.getElementById('test').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['dailyTime', 'emailConfig']);
    const dailyTime = data.dailyTime || { instagram: 0 };
    const config = data.emailConfig;
    
    if (!config || !config.toEmail1 || !config.serviceId || !config.templateId || !config.publicKey) {
      document.getElementById('status').textContent = 'Please configure email settings first';
      return;
    }
    
    const instagramTime = formatTime(dailyTime.instagram || 0);
    
    document.getElementById('status').textContent = 'Sending test emails...';
    
    // Combine emails, filtering out empty ones
    const emails = [config.toEmail1, config.toEmail2].filter(email => email).join(', ');
    
    const emailData = {
      service_id: config.serviceId,
      template_id: config.templateId,
      user_id: config.publicKey,
      template_params: {
        to_email: emails,
        subject: `Vincent Instagram Report (TEST)`,
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
        document.getElementById('status').textContent = 'Test email sent!';
      } else {
        document.getElementById('status').textContent = 'Failed to send email';
      }
    } catch (error) {
      document.getElementById('status').textContent = 'Error: ' + error.message;
    }
  });
});