//js/modules/faviconLoader.js
/*** Website Icon Loader
 * 
 * Handles lazy loading, caching, and error handling of website icons
 */

export class FaviconLoader {
  constructor() {
    this.defaultIcon = 'icons/default-favicon.png';
  }

  initialize() {
    return this;
  }

  prepareIconElement(icon, url) {
    try {
      icon.src = this.buildFaviconPath(url);
      icon.onerror = () => {
        icon.src = this.defaultIcon;
      };
    } catch (e) {
      icon.src = this.defaultIcon;
    }
  }

  buildFaviconPath(pageUrl) {
    const safeUrl = encodeURIComponent(pageUrl);
    return `_favicon/?size=16&pageUrl=${safeUrl}`;
  }
}

export const faviconLoader = new FaviconLoader();
