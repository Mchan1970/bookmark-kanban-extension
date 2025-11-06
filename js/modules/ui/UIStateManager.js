export class UIStateManager {
  /*** @param {HTMLElement} container Main container element
   */
  constructor(container) {
    this.container = container;
  }

  /*** Show loading state
   */
  showLoading() {
    this.container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading your bookmarks...</p>
      </div>
    `;
  }

  /*** Show error message
   * @param {string} message Error message
   */
  showError(message) {
    this.container.innerHTML = `
      <div class="error-message">
        <p>${message}</p>
      </div>
    `;
  }

  /*** Show disabled message when new tab is not enabled
   */
  showDisabledMessage() {
    this.container.innerHTML = `
      <div class="disabled-message">
        <h2>Bookmark Kanban is disabled on new tab</h2>
        <p>You can enable it in the extension settings.</p>
        <button id="enable-newtab" class="btn-primary">Enable on New Tab</button>
      </div>
    `;

    //Add event listener to the enable button
    const enableButton = document.getElementById('enable-newtab');
    if (enableButton) {
      enableButton.addEventListener('click', () => {
        chrome.storage.sync.set({ showOnNewTab: true }, () => {
          location.reload();
        });
      });
    }
  }

  /*** Show empty state when no bookmarks are found
   */
  showEmptyState() {
    this.container.innerHTML = `
      <div class="empty-state">
        <h2>No Bookmarks Found</h2>
        <p>You don't have any bookmarks in your bookmark bar yet.</p>
        <p>Add some bookmarks to get started!</p>
      </div>
    `;
  }

  /*** Show drag guide for new users
   */
  showDragGuide() {
    const guide = document.createElement('div');
    guide.className = 'drag-guide';
    guide.innerHTML = `
      <div class="guide-content">
        <h3>Tip: You can drag to organize</h3>
        <p>Drag columns to reorder them, or drag bookmarks between columns.</p>
        <button class="guide-close">Got it</button>
      </div>
    `;

    document.body.appendChild(guide);

    //Close button handler
    const closeButton = guide.querySelector('.guide-close');
    closeButton.addEventListener('click', () => {
      guide.classList.add('fade-out');
      setTimeout(() => {
        guide.remove();
        
        //Remember that the user has seen the guide
        chrome.storage.sync.set({ dragGuideShown: true });
      }, 300);
    });

    //Auto-hide after some time
    setTimeout(() => {
      guide.classList.add('fade-out');
      setTimeout(() => {
        if (document.body.contains(guide)) {
          guide.remove();
        }
      }, 300);
    }, 10000);
  }
} 