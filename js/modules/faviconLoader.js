//js/modules/faviconLoader.js
/*** Website Icon Loader
 * 
 * Handles lazy loading, caching, and error handling of website icons
 */

export class FaviconLoader {
  constructor() {
    this.iconCache = new Map();
    this.failedHosts = new Set();
    this.defaultIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA2klEQVR4nM3TMUoDURDF8d8mKIqFYGFhYWHhCdR7WFioWNp4AA8gWHkDj2BhYWFhYWEhiKKgKAYM+C1sYFniguIWPnh8Zt7M/2PezBL+qgZWMcYmunhAHxc4wQB3+MANTrGEVmJ+xDxOsJ0D3GIeZwl4G6dYxAzW8IQ1rKfvIT7xjm5U0McFdrD0S7qP2McN3vCKh7hZxiQusYsmbvGMS1QRMY+wgfUE7mAkXa6whzFsYQZ9vOMZYxjHfDQ/4wuTeEETY5iKylXsppkrHGIlmn/UNxpSTyWtFPYrAAAAAElFTkSuQmCC';
    this.observer = null;
  }

  initialize() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const iconElement = entry.target;
          
          if (iconElement.dataset.loaded !== 'true' && iconElement.dataset.hostname) {
            this.loadIcon(iconElement, iconElement.dataset.hostname);
          } else {
            this.observer.unobserve(iconElement);
          }
        }
      });
    }, {
      rootMargin: '100px'
    });

    document.querySelectorAll('.bookmark-icon').forEach(icon => {
      if (icon.dataset.loaded !== 'true') {
        this.observer.observe(icon);
      }
    });

    return this;
  }

  /*** Load icon
   * @param {HTMLImageElement} iconElement Icon element
   * @param {string} hostname Hostname
   */
  async loadIcon(iconElement, hostname) {
    //Check cache
    if (this.iconCache.has(hostname)) {
      this.updateIconWithCache(iconElement, hostname);
      return;
    }

    try {
      //Try to load icon
      const iconUrl = await this.tryLoadIcon(hostname);
      if (iconUrl) {
        this.iconCache.set(hostname, iconUrl);
        this.updateIconStatus(iconElement, true, iconUrl);
        return;
      }

      //If icon loading fails, fall back to default icon
      this.updateIconStatus(iconElement, false, this.defaultIcon);
    } catch (error) {
      console.error(`Failed to load icon: ${hostname}`, error);
      this.updateIconStatus(iconElement, false, this.defaultIcon);
    }
  }

  /*** Try to load icon from different sources
   * @param {string} hostname Hostname
   * @returns {Promise<string|null>} Icon URL or null
   */
  async tryLoadIcon(hostname) {
    //First try Google Favicon service
    try {
      const googleUrl = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
      const available = await this.checkImageAvailable(googleUrl);
      if (available) return googleUrl;
    } catch (error) {
      console.debug('Google Favicon service load failed', error);
    }

    //Try website's own icons
    const iconUrls = [
      `https://${hostname}/favicon.ico`,
      `https://${hostname}/apple-touch-icon.png`
    ];

    for (const url of iconUrls) {
      try {
        const available = await this.checkImageAvailable(url);
        if (available) return url;
      } catch (error) {
        console.debug(`Icon load failed: ${url}`, error);
      }
    }

    return null;
  }

  /*** Check if image is available
   * @param {string} url Image URL
   * @returns {Promise<boolean>}
   */
  checkImageAvailable(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;

      //Set timeout
      setTimeout(() => resolve(false), 3000);
    });
  }

  /*** Update icon status
   * @param {HTMLImageElement} element Icon element
   * @param {boolean} isAvailable Whether available
   * @param {string} iconUrl Icon URL
   */
  updateIconStatus(element, isAvailable, iconUrl) {
    element.src = iconUrl;
    element.dataset.loaded = 'true';
    
    this.observer.unobserve(element);
  }

  /*** Update icon from cache
   * @param {HTMLImageElement} element Icon element
   * @param {string} hostname Hostname
   */
  updateIconWithCache(element, hostname) {
    const iconUrl = this.iconCache.get(hostname);
    this.updateIconStatus(element, true, iconUrl || this.defaultIcon);
  }

  prepareIconElement(icon, url) {
    try {
      const domain = new URL(url).hostname;
      icon.src = `https://www.google.com/s2/favicons?domain=${domain}`;
      icon.onerror = () => {
        //Use local default icon when loading fails
        icon.src = 'icons/default-favicon.png';
      };
    } catch (e) {
      icon.src = 'icons/default-favicon.png';
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

export const faviconLoader = new FaviconLoader();
