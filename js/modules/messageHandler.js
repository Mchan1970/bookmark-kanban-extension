export class MessageHandler {
  constructor(app) {
    this.app = app;
    this.setupMessageListeners();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch(message.type) {
        case 'THEME_CHANGED':
          return this.handleThemeChanged(message, sendResponse);
        case 'DISPLAY_MODE_CHANGED':
          return this.handleDisplayModeChanged(message, sendResponse);
        case 'CHECK_STARTED':
          return this.handleCheckStarted(message);
        case 'CHECK_PROGRESS':
          return this.handleCheckProgress(message);
        case 'CHECK_COMPLETED':
          return this.handleCheckCompleted(message);
        case 'CHECK_FAILED':
          return this.handleCheckFailed(message);
      }
      return true;
    });
  }

  handleThemeChanged(message, sendResponse) {
    this.app.themeManager.applyTheme(message.theme);
    sendResponse({ success: true });
  }

  handleDisplayModeChanged(message, sendResponse) {
    this.app.displayManager.applyDisplayMode(message.mode);
    sendResponse({ success: true });
  }

  handleCheckStarted(message) {
    this.app.siteCheckManager.handleCheckStarted(message.total);
  }

  handleCheckProgress(message) {
    this.app.siteCheckManager.handleCheckProgress(
      message.checked,
      message.total,
      message.current
    );
  }

  handleCheckCompleted(message) {
    this.app.siteCheckManager.handleCheckCompleted(message.siteStatus);
    if (this.app.cleanupManager) {
      this.app.cleanupManager.applySiteStatus(message.siteStatus).catch((error) => {
        console.error('Failed to apply cleanup status update:', error);
      });
    }
  }

  handleCheckFailed(message) {
    this.app.siteCheckManager.handleCheckFailed(message.error);
  }
} 
