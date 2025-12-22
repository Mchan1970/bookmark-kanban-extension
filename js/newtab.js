// js/newtab.js
import { AppCoordinator } from './AppCoordinator.js';
import { themeManager } from './modules/themeManager.js';
import { displayManager } from './modules/displayManager.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await themeManager.initializeTheme();
    await displayManager.initializeDisplayMode();
    const app = new AppCoordinator();
    await app.initialize();
  } catch (error) {
    console.error('Initialization failed:', error);
  }
});
