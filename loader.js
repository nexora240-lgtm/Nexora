(function() {
  'use strict';
  
  // Multiple CDN fallbacks in case jsdelivr fails
  const CDN_SOURCES = [
    'https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora@main',
    'https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora@latest',
    'https://raw.githubusercontent.com/nexora240-lgtm/Nexora/main',
    'https://cdn.statically.io/gh/nexora240-lgtm/Nexora/main'
  ];
  
  let currentCDNIndex = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // ms
  const TIMEOUT_MS = 30000; // 30 seconds
  
  // Polyfill for older browsers
  if (!window.Promise) {
    console.error('❌ Browser does not support Promises. Please upgrade your browser.');
  }
  
  if (!window.fetch) {
    console.warn('⚠️ Fetch API not supported, using XMLHttpRequest fallback');
  }
  
  /**
   * Get current CDN base URL with fallback support
   */
  function getCDNBase() {
    return CDN_SOURCES[currentCDNIndex] || CDN_SOURCES[0];
  }
  
  /**
   * Switch to next CDN source
   */
  function switchCDN() {
    currentCDNIndex = (currentCDNIndex + 1) % CDN_SOURCES.length;
    console.log(`🔄 Switching to CDN: ${getCDNBase()}`);
  }
  
  /**
   * Sleep utility for retries
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Fetch with timeout
   */
  function fetchWithTimeout(url, options = {}, timeout = TIMEOUT_MS) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }
  
  /**
   * XMLHttpRequest fallback for older browsers
   */
  function xhrFetch(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = TIMEOUT_MS;
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            ok: true,
            status: xhr.status,
            text: () => Promise.resolve(xhr.responseText),
            json: () => Promise.resolve(JSON.parse(xhr.responseText))
          });
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Request timeout'));
      xhr.send();
    });
  }
  
  /**
   * Universal fetch with fallback
   */
  function universalFetch(url, options = {}) {
    if (window.fetch) {
      return fetchWithTimeout(url, options);
    } else {
      return xhrFetch(url);
    }
  }
  
  // Define all CSS files to load
  const cssFiles = [
    'css/_tokens.css',
    'css/theme-tokens.css',
    'css/sidebar.css',
    'css/chatbot.css',
    'css/chatroom.css',
    'css/coming-soon.css',
    'css/first-time-modal.css',
    'css/gameloader.css',
    'css/games.css',
    'css/home.css',
    'css/movies.css',
    'css/settings.css'
  ];
  
  // Define all JS files to load in order (excluding service workers)
  const jsFiles = [
    'js/nexora-boot.js',
    'js/views.js',
    'js/app.js',
    'js/chatroom.js',
    'js/first-time-visitor.js',
    'js/settings.js',
    's/embed.js',
    's/index.js',
    's/register-sw.js',
    's/search.js',
    's/uv/uv.bundle.js',
    's/uv/uv.config.js',
    's/uv/uv.handler.js'
  ];
  
  // Service worker files (loaded differently, not as regular scripts)
  const serviceWorkerFiles = [
    's/uv-sw.js',
    's/uv/uv.sw.js'
  ];
  
  // Define all HTML files to load
  const htmlFiles = [
    'index.html',
    'home.html',
    'games.html',
    'movies.html',
    'chatbot.html',
    'chatroom.html',
    'gameloader.html',
    'settings.html',
    'proxy.html',
    'cookies.html',
    'privacy-policy.html',
    's/embed.html'
  ];
  
  // Define all JSON files to load
  const jsonFiles = [
    'game-info.json'
  ];
  
  // Define all text/config files to load
  const textFiles = [
    'robots.txt',
    'ads.txt',
    'CNAME',
    'sitemap.xml'
  ];
  
  /**
   * Load a CSS file dynamically with retry logic
   */
  function loadCSS(href, retryCount = 0) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`link[href*="${href}"]`);
      if (existing) {
        console.log(`♻️ CSS already loaded: ${href}`);
        return resolve(href);
      }
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = `${getCDNBase()}/${href}`;
      link.crossOrigin = 'anonymous';
      
      const timeout = setTimeout(() => {
        link.onerror = null;
        link.onload = null;
        reject(new Error(`CSS load timeout: ${href}`));
      }, TIMEOUT_MS);
      
      link.onload = () => {
        clearTimeout(timeout);
        resolve(href);
      };
      
      link.onerror = async () => {
        clearTimeout(timeout);
        link.remove();
        
        if (retryCount < MAX_RETRIES) {
          console.warn(`⚠️ Retry ${retryCount + 1}/${MAX_RETRIES} for CSS: ${href}`);
          await sleep(RETRY_DELAY);
          
          // Try different CDN
          if (retryCount > 0 && CDN_SOURCES.length > 1) {
            switchCDN();
          }
          
          try {
            const result = await loadCSS(href, retryCount + 1);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Failed to load CSS after ${MAX_RETRIES} retries: ${href}`));
        }
      };
      
      // Append to head with error handling
      try {
        (document.head || document.getElementsByTagName('head')[0]).appendChild(link);
      } catch (err) {
        clearTimeout(timeout);
        reject(new Error(`Failed to append CSS to head: ${err.message}`));
      }
    });
  }
  
  /**
   * Load a JS file dynamically with retry logic
   */
  function loadJS(src, retryCount = 0) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`script[src*="${src}"]`);
      if (existing) {
        console.log(`♻️ JS already loaded: ${src}`);
        return resolve(src);
      }
      
      const script = document.createElement('script');
      script.src = `${getCDNBase()}/${src}`;
      script.async = false; // Maintain execution order
      script.crossOrigin = 'anonymous';
      script.type = 'text/javascript';
      
      const timeout = setTimeout(() => {
        script.onerror = null;
        script.onload = null;
        reject(new Error(`JS load timeout: ${src}`));
      }, TIMEOUT_MS);
      
      script.onload = () => {
        clearTimeout(timeout);
        resolve(src);
      };
      
      script.onerror = async () => {
        clearTimeout(timeout);
        script.remove();
        
        if (retryCount < MAX_RETRIES) {
          console.warn(`⚠️ Retry ${retryCount + 1}/${MAX_RETRIES} for JS: ${src}`);
          await sleep(RETRY_DELAY);
          
          // Try different CDN
          if (retryCount > 0 && CDN_SOURCES.length > 1) {
            switchCDN();
          }
          
          try {
            const result = await loadJS(src, retryCount + 1);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Failed to load JS after ${MAX_RETRIES} retries: ${src}`));
        }
      };
      
      // Append to body with error handling
      try {
        (document.body || document.getElementsByTagName('body')[0] || document.documentElement).appendChild(script);
      } catch (err) {
        clearTimeout(timeout);
        reject(new Error(`Failed to append JS to DOM: ${err.message}`));
      }
    });
  }
  
  /**
   * Load all CSS files in parallel with error handling
   */
  async function loadAllCSS() {
    console.log('🎨 Loading CSS files...');
    const results = await Promise.allSettled(cssFiles.map(file => loadCSS(file)));
    
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    
    console.log(`✅ CSS: ${successful.length}/${cssFiles.length} loaded successfully`);
    
    if (failed.length > 0) {
      console.warn(`⚠️ Failed CSS files (${failed.length}):`, failed.map((r, i) => cssFiles[i]));
    }
    
    return { successful: successful.length, failed: failed.length, total: cssFiles.length };
  }
  
  /**
   * Load all JS files sequentially with error handling
   */
  async function loadAllJS() {
    console.log('📦 Loading JS files...');
    let successful = 0;
    let failed = 0;
    
    for (const file of jsFiles) {
      try {
        await loadJS(file);
        console.log(`✅ Loaded: ${file}`);
        successful++;
      } catch (error) {
        console.error(`❌ Failed: ${file}`, error.message);
        failed++;
        // Continue loading other files even if one fails
      }
    }
    
    console.log(`✅ JS: ${successful}/${jsFiles.length} loaded successfully`);
    
    return { successful, failed, total: jsFiles.length };
  }
  
  /**
   * Register service workers properly
   */
  async function registerServiceWorkers() {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Workers not supported in this browser');
      return { successful: 0, total: serviceWorkerFiles.length };
    }
    
    console.log('🔧 Registering Service Workers...');
    let successful = 0;
    
    for (const file of serviceWorkerFiles) {
      try {
        const url = `${getCDNBase()}/${file}`;
        await navigator.serviceWorker.register(url);
        console.log(`✅ Registered SW: ${file}`);
        successful++;
      } catch (error) {
        console.warn(`⚠️ Failed to register SW: ${file}`, error.message);
      }
    }
    
    return { successful, total: serviceWorkerFiles.length };
  }
  
  /**
   * Fetch and cache HTML content with retry
   */
  async function loadHTML(path, retryCount = 0) {
    try {
      const response = await universalFetch(`${getCDNBase()}/${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      return { path, content, success: true };
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`⚠️ Retry ${retryCount + 1}/${MAX_RETRIES} for HTML: ${path}`);
        await sleep(RETRY_DELAY);
        
        if (retryCount > 0 && CDN_SOURCES.length > 1) {
          switchCDN();
        }
        
        return loadHTML(path, retryCount + 1);
      }
      
      console.error(`❌ Failed to load HTML: ${path}`, error.message);
      return { path, content: null, success: false, error: error.message };
    }
  }
  
  /**
   * Fetch and cache JSON content with retry
   */
  async function loadJSON(path, retryCount = 0) {
    try {
      const response = await universalFetch(`${getCDNBase()}/${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.json();
      return { path, content, success: true };
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`⚠️ Retry ${retryCount + 1}/${MAX_RETRIES} for JSON: ${path}`);
        await sleep(RETRY_DELAY);
        
        if (retryCount > 0 && CDN_SOURCES.length > 1) {
          switchCDN();
        }
        
        return loadJSON(path, retryCount + 1);
      }
      
      console.error(`❌ Failed to load JSON: ${path}`, error.message);
      return { path, content: null, success: false, error: error.message };
    }
  }
  
  /**
   * Fetch and cache text files with retry
   */
  async function loadText(path, retryCount = 0) {
    try {
      const response = await universalFetch(`${getCDNBase()}/${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      return { path, content, success: true };
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`⚠️ Retry ${retryCount + 1}/${MAX_RETRIES} for text: ${path}`);
        await sleep(RETRY_DELAY);
        
        if (retryCount > 0 && CDN_SOURCES.length > 1) {
          switchCDN();
        }
        
        return loadText(path, retryCount + 1);
      }
      
      console.error(`❌ Failed to load text file: ${path}`, error.message);
      return { path, content: null, success: false, error: error.message };
    }
  }
  
  /**
   * Load all HTML files with parallel loading
   */
  async function loadAllHTML() {
    console.log('📄 Loading HTML files...');
    const results = await Promise.allSettled(htmlFiles.map(file => loadHTML(file)));
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const loaded = successful.length;
    console.log(`✅ HTML: ${loaded}/${htmlFiles.length} loaded successfully`);
    return results.map(r => r.status === 'fulfilled' ? r.value : { path: '', success: false });
  }
  
  /**
   * Load all JSON files with parallel loading
   */
  async function loadAllJSON() {
    console.log('📋 Loading JSON files...');
    const results = await Promise.allSettled(jsonFiles.map(file => loadJSON(file)));
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const loaded = successful.length;
    console.log(`✅ JSON: ${loaded}/${jsonFiles.length} loaded successfully`);
    return results.map(r => r.status === 'fulfilled' ? r.value : { path: '', success: false });
  }
  
  /**
   * Load all text/config files with parallel loading
   */
  async function loadAllText() {
    console.log('📝 Loading text/config files...');
    const results = await Promise.allSettled(textFiles.map(file => loadText(file)));
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const loaded = successful.length;
    console.log(`✅ Text: ${loaded}/${textFiles.length} loaded successfully`);
    return results.map(r => r.status === 'fulfilled' ? r.value : { path: '', success: false });
  }
  
  /**
   * Main loader function with comprehensive error handling
   */
  async function initNexoraLoader() {
    console.log('🚀 Nexora Loader Initializing...');
    console.log(`📍 CDN Base: ${getCDNBase()}`);
    
    // Check browser compatibility
    const isCompatible = checkBrowserCompatibility();
    if (!isCompatible.compatible) {
      console.error('❌ Browser compatibility issues:', isCompatible.issues);
      // Continue anyway but warn user
    }
    
    const startTime = performance.now();
    let cssStats, jsStats, swStats, htmlResults, jsonResults, textResults;
    
    try {
      // Load everything with proper error handling
      cssStats = await loadAllCSS();
      jsStats = await loadAllJS();
      swStats = await registerServiceWorkers();
      htmlResults = await loadAllHTML();
      jsonResults = await loadAllJSON();
      textResults = await loadAllText();
      
      const endTime = performance.now();
      const loadTime = ((endTime - startTime) / 1000).toFixed(2);
      
      const totalLoaded = cssStats.successful + jsStats.successful + 
                         swStats.successful +
                         htmlResults.filter(r => r.success).length + 
                         jsonResults.filter(r => r.success).length + 
                         textResults.filter(r => r.success).length;
      
      const totalFiles = cssStats.total + jsStats.total + 
                        swStats.total +
                        htmlResults.length + jsonResults.length + textResults.length;
      
      console.log(`🎉 Nexora Loader Complete! (${loadTime}s)`);
      console.log(`📊 Total: ${totalLoaded}/${totalFiles} files loaded successfully`);
      
      // Store loaded content in window object with safe access
      window.NexoraContent = window.NexoraContent || {};
      
      Object.assign(window.NexoraContent, {
        html: htmlResults.reduce((acc, r) => {
          if (r.success) acc[r.path] = r.content;
          return acc;
        }, {}),
        json: jsonResults.reduce((acc, r) => {
          if (r.success) acc[r.path] = r.content;
          return acc;
        }, {}),
        text: textResults.reduce((acc, r) => {
          if (r.success) acc[r.path] = r.content;
          return acc;
        }, {}),
        stats: {
          css: cssStats,
          js: jsStats,
          serviceWorkers: swStats,
          html: { successful: htmlResults.filter(r => r.success).length, total: htmlResults.length },
          json: { successful: jsonResults.filter(r => r.success).length, total: jsonResults.length },
          text: { successful: textResults.filter(r => r.success).length, total: textResults.length }
        }
      });
      
      // Dispatch custom event when everything is loaded
      const event = new CustomEvent('nexora:loaded', {
        detail: {
          loadTime: loadTime,
          totalLoaded: totalLoaded,
          totalFiles: totalFiles,
          stats: window.NexoraContent.stats,
          content: window.NexoraContent
        }
      });
      
      window.dispatchEvent(event);
      
      // Also dispatch to document for broader compatibility
      if (document.dispatchEvent) {
        document.dispatchEvent(event);
      }
      
      return { success: true, stats: window.NexoraContent.stats };
      
    } catch (error) {
      console.error('❌ Critical error in Nexora Loader:', error);
      
      // Dispatch error event
      const errorEvent = new CustomEvent('nexora:error', {
        detail: { error: error.message, stack: error.stack }
      });
      
      window.dispatchEvent(errorEvent);
      
      if (document.dispatchEvent) {
        document.dispatchEvent(errorEvent);
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check browser compatibility
   */
  function checkBrowserCompatibility() {
    const issues = [];
    
    if (!window.Promise) issues.push('Promise not supported');
    if (!window.fetch && !window.XMLHttpRequest) issues.push('No fetch or XHR support');
    if (!document.createElement) issues.push('Cannot create DOM elements');
    if (!window.CustomEvent) issues.push('CustomEvent not supported');
    if (!Array.prototype.map) issues.push('Array.map not supported');
    if (!Array.prototype.filter) issues.push('Array.filter not supported');
    if (!Object.assign) issues.push('Object.assign not supported');
    
    return {
      compatible: issues.length === 0,
      issues: issues
    };
  }
  
  /**
   * Safe initialization wrapper
   */
  function safeInit() {
    try {
      initNexoraLoader().catch(error => {
        console.error('❌ Unhandled error in loader:', error);
      });
    } catch (error) {
      console.error('❌ Failed to initialize loader:', error);
    }
  }
  
  // Start loading when DOM is ready with multiple fallbacks
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', safeInit);
      } else if (document.attachEvent) {
        // IE8 fallback
        document.attachEvent('onreadystatechange', function() {
          if (document.readyState === 'complete') safeInit();
        });
      }
    } else {
      // DOM already loaded
      safeInit();
    }
    
    // Fallback: if DOMContentLoaded never fires
    setTimeout(function() {
      if (!window.NexoraLoader || !window.NexoraLoader.initialized) {
        console.warn('⚠️ DOMContentLoaded timeout, forcing initialization');
        safeInit();
      }
    }, 5000);
  } else {
    console.error('❌ Document object not available');
  }
  
  // Expose loader info globally with safe property access
  try {
    window.NexoraLoader = window.NexoraLoader || {};
    Object.assign(window.NexoraLoader, {
      version: '3.0.0',
      initialized: false,
      cdnSources: CDN_SOURCES,
      currentCDN: getCDNBase,
      cssFiles: cssFiles,
      jsFiles: jsFiles,
      serviceWorkerFiles: serviceWorkerFiles,
      htmlFiles: htmlFiles,
      jsonFiles: jsonFiles,
      textFiles: textFiles,
      reload: function() {
        console.log('🔄 Reloading Nexora...');
        currentCDNIndex = 0; // Reset CDN
        return initNexoraLoader();
      },
      switchCDN: switchCDN,
      getTotalFileCount: function() {
        return cssFiles.length + jsFiles.length + 
               serviceWorkerFiles.length + htmlFiles.length + jsonFiles.length + 
               textFiles.length;
      },
      getContent: function(type, path) {
        if (!window.NexoraContent) return null;
        return window.NexoraContent[type] ? window.NexoraContent[type][path] : null;
      },
      getStats: function() {
        return window.NexoraContent ? window.NexoraContent.stats : null;
      }
    });
    
    // Mark as initialized after first load
    window.addEventListener('nexora:loaded', function() {
      window.NexoraLoader.initialized = true;
    });
    
  } catch (error) {
    console.error('❌ Failed to expose NexoraLoader:', error);
  }
  
})();
