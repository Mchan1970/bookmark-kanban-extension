export class NotificationManager {
  showToast(message, type = 'success') {
    //CreateMessageElement
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 15px';
    toast.style.backgroundColor = type === 'error' ? '#ef4444' : '#10b981';
    toast.style.color = 'white';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    
    //Add到页面
    document.body.appendChild(toast);
    
    //淡入效果
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    //淡出并Remove
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
  
  showErrorToast(message) {
    this.showToast(message, 'error');
  }
  
  showWarningToast(message) {
    this.showToast(message, 'warning');
  }
} 