export class SiteCheckManager {
  constructor(app) {
    this.app = app;
  }

  async handleSiteCheck() {
    const checkButton = document.getElementById('check-sites-button');
    
    //防止多次Click
    if (checkButton.classList.contains('checking')) {
      return;
    }
    
    try {
      //发送Message到后台服务
      await chrome.runtime.sendMessage({ 
        type: 'CHECK_BOOKMARKS'
      });
    } catch (error) {
      console.error('Site check error:', error);
      this.app.notificationManager.showErrorToast('An error occurred during bookmark check');
      
      //恢复ButtonState
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
        //完全None法访问
        item.setAttribute('data-site-status', 'dead');
      } else if (status === 'certificate-error') {
        //证书Error但Domain存在
        item.setAttribute('data-site-status', 'cert-error');
      } else if (status === 'no-https') {
        //只Support HTTP 访问
        item.setAttribute('data-site-status', 'no-https');
      } else {
        //完全可用
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
    
    //Update UI 以反映Check结果
    this.updateBookmarkStatus(siteStatus);
    
    //Show完成Message
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