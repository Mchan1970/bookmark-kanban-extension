export class SiteCheckManager {
  constructor(app) {
    this.app = app;
  }

  async handleSiteCheck() {
    const checkButton = document.getElementById('check-sites-button');
    
    // Ignore repeated clicks while a check is running
    if (checkButton.classList.contains('checking')) {
      return;
    }
    
    try {
      // Ask the background service to perform the site check
      await chrome.runtime.sendMessage({ 
        type: 'CHECK_BOOKMARKS'
      });
    } catch (error) {
      console.error('Site check error:', error);
      this.app.notificationManager.showErrorToast('An error occurred during bookmark check');
      
      // Restore button state on failure
      const checkButton = document.getElementById('check-sites-button');
      const progressElement = checkButton.querySelector('.check-progress');
      if (checkButton && progressElement) {
        checkButton.classList.remove('checking');
        progressElement.style.display = 'none';
        checkButton.title = "Check bookmarks availability";
      }
    }
  }

  updateBookmarkStatus(siteStatus) {
    const bookmarkItems = document.querySelectorAll('.bookmark-item');
    bookmarkItems.forEach(item => {
      const bookmarkId = item.dataset.bookmarkId;
      const status = siteStatus[bookmarkId];
      
      if (status === false) {
        // Completely unreachable
        item.setAttribute('data-site-status', 'dead');
      } else if (status === 'certificate-error') {
        // Certificate issue but the domain resolves
        item.setAttribute('data-site-status', 'cert-error');
      } else if (status === 'no-https') {
        // HTTP only (no HTTPS support)
        item.setAttribute('data-site-status', 'no-https');
      } else {
        // Fully available
        item.removeAttribute('data-site-status');
      }
    });
  }

  handleCheckStarted(total) {
    const checkButton = document.getElementById('check-sites-button');
    const progressElement = checkButton.querySelector('.check-progress');
    
    checkButton.classList.add('checking');
    progressElement.style.display = 'inline-block';
    progressElement.textContent = `0/${total}`;
  }

  handleCheckProgress(checked, total, current) {
    const checkButton = document.getElementById('check-sites-button');
    const progressElement = checkButton.querySelector('.check-progress');
    
    progressElement.textContent = `${checked}/${total}`;
    checkButton.title = `Checking: ${current}`;
  }

  handleCheckCompleted(siteStatus) {
    const checkButton = document.getElementById('check-sites-button');
    const progressElement = checkButton.querySelector('.check-progress');
    
    checkButton.classList.remove('checking');
    progressElement.style.display = 'none';
    checkButton.title = "Check bookmarks availability";
    
    // Update the UI to reflect the check results
    this.updateBookmarkStatus(siteStatus);
    
    // Show completion notification
    const deadLinks = Object.values(siteStatus).filter(status => !status).length;
    this.app.notificationManager.showToast(`Bookmark check completed! ${deadLinks} dead links found.`);
  }

  handleCheckFailed(errorMessage) {
    const checkButton = document.getElementById('check-sites-button');
    const progressElement = checkButton.querySelector('.check-progress');
    
    checkButton.classList.remove('checking');
    progressElement.style.display = 'none';
    checkButton.title = "Check bookmarks availability";
    
    this.app.notificationManager.showErrorToast(`Bookmark check failed: ${errorMessage}`);
  }
} 
