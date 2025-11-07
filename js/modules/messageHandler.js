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

}
