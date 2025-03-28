/**
 * Website Status Checker
 * Used to detect website availability status
 */
export class SiteChecker {
  constructor() {
    this.siteStatus = new Map();
    this.checkTimes = new Map();
    
    // Cache duration configuration (milliseconds)
    this.CACHE_DURATION = {
      SUCCESS: 24 * 60 * 60 * 1000,  // Success status cache 24 hours
      FAILURE: 1 * 60 * 60 * 1000    // Failure status cache 1 hour
    };
    
    // Request timeout (milliseconds)
    this.TIMEOUT = 5000;
  }

  /**
   * Check website status
   * @param {string} hostname Hostname
   * @returns {Promise<boolean>} Whether website is available
   */
  async checkSite(hostname) {
    // Check cache
    if (!this.shouldRecheck(hostname)) {
      return this.getCachedStatus(hostname);
    }

    try {
      const available = await this.checkAvailability(hostname);
      this.updateCache(hostname, available);
      return available;
    } catch (error) {
      console.error(`Failed to check website: ${hostname}`, error);
      this.updateCache(hostname, false);
      return false;
    }
  }

  /**
   * Get cached status
   * @param {string} hostname Hostname
   * @returns {boolean|null} Cached status, null if no cache
   */
  getCachedStatus(hostname) {
    if (this.isCacheValid(hostname)) {
      return this.siteStatus.get(hostname);
    }
    return null;
  }

  /**
   * Determine if recheck is needed
   * @param {string} hostname Hostname
   * @returns {boolean}
   */
  shouldRecheck(hostname) {
    if (!this.checkTimes.has(hostname)) {
      return true;
    }

    const lastCheck = this.checkTimes.get(hostname);
    const status = this.siteStatus.get(hostname);
    const cacheDuration = status ? this.CACHE_DURATION.SUCCESS : this.CACHE_DURATION.FAILURE;
    
    return Date.now() - lastCheck > cacheDuration;
  }

  /**
   * Perform availability check
   * @param {string} hostname Hostname
   * @returns {Promise<boolean>}
   */
  async checkAvailability(hostname) {
    // Build list of URLs to check
    const urls = [
      `https://${hostname}/favicon.ico`,
      `https://${hostname}/apple-touch-icon.png`,
      `https://${hostname}`
    ];

    // Try each URL in sequence
    for (const url of urls) {
      try {
        const available = await this.tryHeadRequest(url);
        if (available) {
          return true;
        }
      } catch (error) {
        console.debug(`Failed to check URL: ${url}`, error);
        continue;
      }
    }

    return false;
  }

  /**
   * Try HEAD request
   * @param {string} url URL
   * @returns {Promise<boolean>}
   */
  async tryHeadRequest(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.debug(`Request timeout: ${url}`);
      }
      return false;
    }
  }

  /**
   * Check if cache is valid
   * @param {string} hostname Hostname
   * @returns {boolean}
   */
  isCacheValid(hostname) {
    if (!this.checkTimes.has(hostname)) {
      return false;
    }

    const lastCheck = this.checkTimes.get(hostname);
    const status = this.siteStatus.get(hostname);
    const cacheDuration = status ? this.CACHE_DURATION.SUCCESS : this.CACHE_DURATION.FAILURE;
    
    return Date.now() - lastCheck <= cacheDuration;
  }

  /**
   * Update cache
   * @param {string} hostname Hostname
   * @param {boolean} status Status
   */
  updateCache(hostname, status) {
    this.siteStatus.set(hostname, status);
    this.checkTimes.set(hostname, Date.now());
  }
}

// Export singleton
export const siteChecker = new SiteChecker(); 