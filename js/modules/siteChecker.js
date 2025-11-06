/*** Website Status Checker
 * Used to detect website availability status
 */
export class SiteChecker {
  constructor() {
    this.siteStatus = new Map();
    this.checkTimes = new Map();
    
    //Cache duration configuration (milliseconds)
    this.CACHE_DURATION = {
      SUCCESS: 24 * 60 * 60 * 1000,     //Success status cache 24 hours
      FAILURE: 1 * 60 * 60 * 1000,      //Failure status cache 1 hour
      CERT_ERROR: 12 * 60 * 60 * 1000,  //Certificate error cache 12 hours
      NO_HTTPS: 12 * 60 * 60 * 1000     //No HTTPS support cache 12 hours
    };
    
    //Request timeout (milliseconds)
    this.TIMEOUT = 5000;
    
    //Maximum cache size
    this.MAX_CACHE_SIZE = 500;
    
    //Total check timeout for each site (milliseconds)
    this.TOTAL_CHECK_TIMEOUT = 5000;
    
    //Initialize periodic cache cleanup
    this.initCacheCleanup();
    
    // Debug mode flag - set to false to silence debug logging
    this.isDebug = false;
  }

  /*** Debug log helper
   * @private
   */
  _debug(...args) {
    if (this.isDebug) {
      console.debug(...args);
    }
  }

  /*** Initialize periodic cache cleanup
   */
  initCacheCleanup() {
    //Clean cache every 15 minutes
    setInterval(() => this.cleanupCache(), 15 * 60 * 1000);
  }

  /*** Check if hostname is a local network address
   * @param {string} hostname Hostname to check
   * @returns {boolean} True if it's a local network address
   */
  isLocalNetwork(hostname) {
    //Check for localhost and IP formats
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') || 
        hostname.startsWith('10.') || 
        hostname.endsWith('.local')) {
      return true;
    }
    
    //Check for 172.16.x.x to 172.31.x.x range
    if (hostname.startsWith('172.')) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const secondPart = parseInt(parts[1], 10);
        if (secondPart >= 16 && secondPart <= 31) {
          return true;
        }
      }
    }
    
    return false;
  }

  /*** Check website status with overall timeout
   * @param {string} hostname Hostname
   * @returns {Promise<boolean|string>} Whether website is available or certificate error
   */
  async checkSite(hostname) {
    //Skip checking for local network addresses
    if (this.isLocalNetwork(hostname)) {
      return true;
    }
    
    //Check cache
    if (!this.shouldRecheck(hostname)) {
      return this.getCachedStatus(hostname);
    }

    try {
      //Create a promise that rejects after TOTAL_CHECK_TIMEOUT
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Check timeout')), this.TOTAL_CHECK_TIMEOUT);
      });

      //Race between the check and the timeout
      const status = await Promise.race([
        this.checkAvailability(hostname),
        timeoutPromise
      ]);

      this.updateCache(hostname, status);
      return status;
    } catch (error) {
      this._debug(`Site check failed for ${hostname}: ${error.message}`);
      this.updateCache(hostname, false);
      return false;
    }
  }

  /*** Get cached status
   * @param {string} hostname Hostname
   * @returns {boolean|string|null} Cached status, null if no cache
   */
  getCachedStatus(hostname) {
    if (this.isCacheValid(hostname)) {
      return this.siteStatus.get(hostname);
    }
    return null;
  }

  /*** Determine if recheck is needed
   * @param {string} hostname Hostname
   * @returns {boolean}
   */
  shouldRecheck(hostname) {
    if (!this.checkTimes.has(hostname)) {
      return true;
    }

    const lastCheck = this.checkTimes.get(hostname);
    const status = this.siteStatus.get(hostname);
    const cacheDuration = this.getCacheDuration(status);
    
    return Date.now() - lastCheck > cacheDuration;
  }

  /*** Get cache duration based on status
   * @param {boolean|string} status Status
   * @returns {number} Cache duration in milliseconds
   */
  getCacheDuration(status) {
    if (status === true) return this.CACHE_DURATION.SUCCESS;
    if (status === 'certificate-error') return this.CACHE_DURATION.CERT_ERROR;
    if (status === 'no-https') return this.CACHE_DURATION.NO_HTTPS;
    return this.CACHE_DURATION.FAILURE;
  }

  /*** Perform availability check
   * @param {string} hostname Hostname
   * @returns {Promise<boolean|string>}
   */
  async checkAvailability(hostname) {
    // Try HTTPS first
    const httpsUrls = [
      `https://${hostname}/favicon.ico`,
      `https://${hostname}/robots.txt`,
      `https://${hostname}`
    ];

    // Then try HTTP if HTTPS fails
    const httpUrls = [
      `http://${hostname}/favicon.ico`,
      `http://${hostname}/robots.txt`,
      `http://${hostname}`
    ];

    let httpsError = null;

    // Attempt HTTPS first
    for (const url of httpsUrls) {
      try {
        const available = await this.tryHeadRequest(url);
        if (available) {
          return true; // HTTPS is reachable
        }
      } catch (error) {
        httpsError = error;
        this._debug(`HTTPS check failed: ${url}`); // Simplified debug output
        continue;
      }
    }

    // If HTTPS fails, attempt HTTP
    for (const url of httpUrls) {
      try {
        const available = await this.tryHeadRequest(url);
        if (available) {
          return 'no-https'; // HTTP works but HTTPS is unavailable
        }
      } catch (error) {
        this._debug(`HTTP check failed: ${url}`); // Simplified debug output
        continue;
      }
    }

    // If both HTTP and HTTPS fail, check whether the domain resolves
    const domainExists = await this.checkDomainExists(hostname);
    if (domainExists) {
      // If the domain exists and the earlier HTTPS error was certificate-related, mark it accordingly
      if (httpsError && 
          (httpsError.name === 'TypeError' && httpsError.message.includes('Failed to fetch'))) {
        return 'certificate-error';
      }
    }

    return false; // Site is completely unreachable
  }

  /*** Check if domain exists through DNS
   * @param {string} hostname Hostname
   * @returns {Promise<boolean>} Whether domain resolves
   */
  async checkDomainExists(hostname) {
    return new Promise(resolve => {
      const img = new Image();
      const timeoutId = setTimeout(() => {
        img.src = '';
        resolve(false);
      }, 2000);
      
      img.onload = img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };
      
      img.src = `https://${hostname}/favicon.ico?nocache=${Date.now()}`;
    });
  }

  /*** Try HEAD request
   * @param {string} url URL
   * @returns {Promise<boolean>}
   */
  async tryHeadRequest(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        this._debug(`Request timeout: ${url}`); // Log using debug helper
      } else {
        this._debug(`Request failed: ${url}`); // Simplified debug output
      }
      throw error;
    }
  }

  /*** Check if cache is valid
   * @param {string} hostname Hostname
   * @returns {boolean}
   */
  isCacheValid(hostname) {
    if (!this.checkTimes.has(hostname)) {
      return false;
    }

    const lastCheck = this.checkTimes.get(hostname);
    const status = this.siteStatus.get(hostname);
    const cacheDuration = this.getCacheDuration(status);
    
    return Date.now() - lastCheck <= cacheDuration;
  }

  /*** Update cache
   * @param {string} hostname Hostname
   * @param {boolean|string} status Status
   */
  updateCache(hostname, status) {
    // Enforce cache size limits
    if (this.siteStatus.size >= this.MAX_CACHE_SIZE) {
      this.limitCacheSize();
    }
    
    this.siteStatus.set(hostname, status);
    this.checkTimes.set(hostname, Date.now());
  }

  /*** Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const expiredHosts = [];
    
    for (const [hostname, timestamp] of this.checkTimes.entries()) {
      const status = this.siteStatus.get(hostname);
      const cacheDuration = this.getCacheDuration(status);
      
      if (now - timestamp > cacheDuration) {
        expiredHosts.push(hostname);
      }
    }
    
    expiredHosts.forEach(hostname => {
      this.siteStatus.delete(hostname);
      this.checkTimes.delete(hostname);
    });
    
    this._debug(`Cache cleanup: removed ${expiredHosts.length} entries`); // Log using debug helper
  }

  /*** Limit cache size by removing oldest entries
   */
  limitCacheSize() {
    const entries = Array.from(this.checkTimes.entries());
    entries.sort((a, b) => a[1] - b[1]);
    
    const removeCount = Math.ceil(this.MAX_CACHE_SIZE * 0.2);
    const toRemove = entries.slice(0, removeCount);
    
    toRemove.forEach(([hostname]) => {
      this.siteStatus.delete(hostname);
      this.checkTimes.delete(hostname);
    });
    
    this._debug(`Cache size limited: removed ${toRemove.length} entries`); // Log using debug helper
  }
}

//Export singleton
export const siteChecker = new SiteChecker(); 
