/**
 * Background Service Worker for Bookmark Kanban
 */

import { AccessTracker } from './modules/accessTracker.js';

const accessTracker = new AccessTracker();
accessTracker.initialize().catch(() => {
  // Initialization failures shouldn't break other functionality
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_BOOKMARKS':
      chrome.bookmarks.getTree((tree) => sendResponse({ bookmarks: tree }));
      return true;
    case 'UPDATE_BOOKMARK':
      chrome.bookmarks.update(message.bookmarkId, message.changes, (bookmark) => {
        sendResponse({ success: true, bookmark });
      });
      return true;
    case 'DELETE_BOOKMARK':
      chrome.bookmarks.removeTree(message.bookmarkId, () => {
        sendResponse({ success: true });
      });
      return true;
    case 'CREATE_BOOKMARK':
      chrome.bookmarks.create(message.bookmark, (bookmark) => {
        sendResponse({ success: true, bookmark });
      });
      return true;
    default:
      return false;
  }
});

function broadcastToTabs(payload) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
    });
  });
}

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  broadcastToTabs({ type: 'BOOKMARK_CREATED', bookmark });
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  broadcastToTabs({ type: 'BOOKMARK_REMOVED', id, removeInfo });
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  broadcastToTabs({ type: 'BOOKMARK_CHANGED', id, changeInfo });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.startsWith('chrome://newtab')) {
    chrome.tabs.reload(tab.id);
  }
});
