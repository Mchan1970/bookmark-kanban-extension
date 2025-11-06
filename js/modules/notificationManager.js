export class NotificationManager {
  showToast(message, type = 'success') {
    const toast = this.createToast(message, type);
    this.mountToast(toast);
    this.scheduleRemoval(toast, 3000);
  }
  
  showErrorToast(message) {
    this.showToast(message, 'error');
  }
  
  showWarningToast(message) {
    this.showToast(message, 'warning');
  }

  showActionToast(message, actionLabel, onAction, type = 'success') {
    const toast = this.createToast(message, type);
    toast.style.display = 'inline-flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';

    const actionButton = document.createElement('button');
    actionButton.textContent = actionLabel;
    actionButton.style.background = 'transparent';
    actionButton.style.border = '1px solid rgba(255,255,255,0.7)';
    actionButton.style.borderRadius = '3px';
    actionButton.style.color = '#ffffff';
    actionButton.style.padding = '4px 8px';
    actionButton.style.cursor = 'pointer';
    actionButton.style.fontSize = '0.85rem';

    toast.appendChild(actionButton);

    this.mountToast(toast);

    const removalTimer = this.scheduleRemoval(toast, 5000);

    actionButton.addEventListener('click', () => {
      if (removalTimer) {
        clearTimeout(removalTimer);
      }
      if (typeof onAction === 'function') {
        try {
          onAction();
        } catch (error) {
          console.error('Toast action failed:', error);
        }
      }
      this.removeToast(toast);
    });
  }

  createToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 15px';
    toast.style.backgroundColor = this.resolveBackground(type);
    toast.style.color = '#ffffff';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.maxWidth = '340px';
    toast.style.fontSize = '0.9rem';
    return toast;
  }

  resolveBackground(type) {
    if (type === 'error') {
      return '#ef4444';
    }
    if (type === 'warning') {
      return '#f59e0b';
    }
    return '#10b981';
  }

  mountToast(toast) {
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
    });
  }

  scheduleRemoval(toast, delay) {
    return setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => this.removeToast(toast), 300);
    }, delay);
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) {
      return;
    }
    toast.parentNode.removeChild(toast);
  }
} 
