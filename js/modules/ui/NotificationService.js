export class NotificationService {
  /*** Show toast notification
   * @param {string} message Message to display
   * @param {string} type Notification type (info, success, error)
   * @param {number} duration Duration in milliseconds
   */
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 15px';
    
    //Set background color based on type
    toast.style.backgroundColor = 
      type === 'error' ? 'var(--danger-color)' : 
      type === 'success' ? 'var(--success-color)' : 
      'var(--primary-color)';
    
    toast.style.color = 'white';
    toast.style.borderRadius = 'var(--border-radius)';
    toast.style.boxShadow = 'var(--shadow)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.maxWidth = '80%';
    toast.style.wordBreak = 'break-word';
    
    document.body.appendChild(toast);
    
    //Fade in
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    //Fade out and remove
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  /*** Show success toast
   * @param {string} message Message to display
   * @param {number} duration Duration in milliseconds
   */
  showSuccessToast(message, duration = 3000) {
    this.showToast(message, 'success', duration);
  }

  /*** Show error toast
   * @param {string} message Message to display
   * @param {number} duration Duration in milliseconds
   */
  showErrorToast(message, duration = 3000) {
    this.showToast(message, 'error', duration);
  }

  /*** Show warning toast
   * @param {string} message Message to display
   * @param {number} duration Duration in milliseconds
   */
  showWarningToast(message, duration = 3000) {
    this.showToast(message, 'warning', duration);
  }
} 