// URL Bar Component
(function() {
  'use strict';

  // Create URL bar element
  function createUrlBar() {
    const urlBar = document.createElement('div');
    urlBar.className = 'url-bar';
    urlBar.setAttribute('role', 'status');
    urlBar.setAttribute('aria-live', 'polite');
    urlBar.setAttribute('aria-label', 'Website URL');
    
    urlBar.innerHTML = `
      <div class="url-bar-url" id="url-bar-text"></div>
    `;
    
    document.body.appendChild(urlBar);
    return urlBar;
  }

  // Extract clean domain from URL
  function getCleanDomain(url) {
    try {
      const urlObj = new URL(url);
      // Return just the hostname (domain)
      return urlObj.hostname;
    } catch (e) {
      // Fallback if URL parsing fails
      return 'thenexoraproject.xyz';
    }
  }

  // Update URL display
  function updateUrlDisplay() {
    const urlText = document.getElementById('url-bar-text');
    if (!urlText) return;
    
    const currentUrl = window.location.href;
    const cleanDomain = getCleanDomain(currentUrl);
    urlText.textContent = cleanDomain;
    urlText.setAttribute('title', currentUrl);
  }

  // Copy URL to clipboard
  function copyUrlToClipboard() {
    // Removed - no copy functionality needed
  }

  // Fallback copy method
  function fallbackCopyTextToClipboard(text, btn) {
    // Removed - no copy functionality needed
  }

  // Show copy success feedback
  function showCopySuccess(btn) {
    // Removed - no copy functionality needed
  }

  // Initialize URL bar
  function initUrlBar() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  function init() {
    // Create the URL bar
    createUrlBar();
    
    // Initial update
    updateUrlDisplay();
    
    // Listen for URL changes (for SPA navigation)
    window.addEventListener('popstate', updateUrlDisplay);
    
    // Watch for pushState/replaceState (custom events if app.js dispatches them)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      updateUrlDisplay();
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      updateUrlDisplay();
    };
    
    // Update on hash changes too
    window.addEventListener('hashchange', updateUrlDisplay);
    
    // Observe route changes via MutationObserver (for content changes)
    const appElement = document.getElementById('app');
    if (appElement) {
      const observer = new MutationObserver(() => {
        updateUrlDisplay();
      });
      
      observer.observe(appElement, {
        childList: true,
        subtree: false
      });
    }
  }

  // Start initialization
  initUrlBar();
})();
