"use strict";

// Tab Management
let tabCounter = 0;
let activeTabId = null;
const searchEngineUrl = "https://duckduckgo.com/?q=%s";

// Helper to get favicon
function getFavicon(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (e) {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'/%3E%3C/svg%3E";
  }
}

// Get proxy URL
function getProxyUrl(url) {
  if (typeof __uv$config !== 'undefined') {
    return __uv$config.prefix + __uv$config.encodeUrl(url);
  }
  return "/s/ultraviolet/" + encodeURIComponent(url);
}

// Search function (from arsenic)
function search(input, template) {
  try {
    return new URL(input).toString();
  } catch (err) {
    // input was not a valid URL
  }

  try {
    const url = new URL(`http://${input}`);
    if (url.hostname.includes(".")) return url.toString();
  } catch (err) {
    // input was not valid URL
  }

  return template.replace("%s", encodeURIComponent(input));
}

// Switch to a tab
function switchToTab(tabId) {
  // Remove active class from all tabs and iframes
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.proxy-frame').forEach(frame => frame.classList.remove('active'));
  
  // Add active class to selected tab and iframe
  const selectedTab = document.getElementById(tabId);
  const selectedFrame = document.getElementById(`${tabId}-frame`);
  
  if (selectedTab) selectedTab.classList.add('active');
  if (selectedFrame) {
    selectedFrame.classList.add('active');
    activeTabId = tabId;
    
    // Check if iframe has a URL loaded
    if (selectedFrame.src && selectedFrame.src !== 'about:blank' && selectedFrame.src !== window.location.href) {
      // Hide welcome screen if tab has content
      document.getElementById('welcome-screen').style.display = 'none';
    } else {
      // Show welcome screen if tab is empty
      document.getElementById('welcome-screen').style.display = 'flex';
    }
  } else {
    // No iframe, show welcome screen
    document.getElementById('welcome-screen').style.display = 'flex';
  }
}

// Close tab
function closeTab(tabId) {
  const tab = document.getElementById(tabId);
  const frame = document.getElementById(`${tabId}-frame`);
  
  if (tab) tab.remove();
  if (frame) frame.remove();
  
  // If this was active tab, switch to first available or show welcome
  if (activeTabId === tabId) {
    const remainingTabs = document.querySelectorAll('.tab');
    if (remainingTabs.length > 0) {
      switchToTab(remainingTabs[0].id);
    } else {
      activeTabId = null;
      document.getElementById('welcome-screen').style.display = 'flex';
      document.getElementById('address-bar').value = '';
    }
  }
}

// Create new tab
function createNewTab() {
  const tabId = `tab-${++tabCounter}`;
  const tabBar = document.getElementById('tab-bar');
  const newTabBtn = tabBar.querySelector('.new-tab-btn');
  
  // Create tab button
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.id = tabId;
  tab.innerHTML = `
    <img class="tab-favicon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'/%3E%3C/svg%3E" alt="">
    <span class="tab-title">New Tab</span>
    <button class="tab-close" onclick="closeTab('${tabId}')">×</button>
  `;
  
  tab.onclick = function(e) {
    if (!e.target.classList.contains('tab-close')) {
      switchToTab(tabId);
    }
  };
  
  tabBar.insertBefore(tab, newTabBtn);
  
  // Create iframe
  const contentArea = document.getElementById('content-area');
  const iframe = document.createElement('iframe');
  iframe.className = 'proxy-frame';
  iframe.id = `${tabId}-frame`;
  iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";
  iframe.allow = "fullscreen; geolocation; microphone; camera";
  
  iframe.onload = function() {
    hideLoading();
    try {
      if (iframe.contentDocument && iframe.contentDocument.title) {
        tab.querySelector('.tab-title').textContent = iframe.contentDocument.title || 'Untitled';
      }
    } catch (e) {
      // CORS blocked
    }
    
    // Try to intercept link clicks to open in new tabs
    setupLinkInterception(iframe);
  };
  
  contentArea.appendChild(iframe);
  
  // Switch to new tab
  switchToTab(tabId);
  document.getElementById('address-bar').focus();
}

// Open proxy page
function openProxyPage(url) {
  registerSW().then(() => {
    const tabId = activeTabId || `tab-${++tabCounter}`;
    let tab = document.getElementById(tabId);
    let iframe = document.getElementById(`${tabId}-frame`);
    
    // If no active tab, create one
    if (!tab) {
      const tabBar = document.getElementById('tab-bar');
      const newTabBtn = tabBar.querySelector('.new-tab-btn');
      
      tab = document.createElement('div');
      tab.className = 'tab';
      tab.id = tabId;
      tab.innerHTML = `
        <img class="tab-favicon" src="${getFavicon(url)}" alt="">
        <span class="tab-title">Loading...</span>
        <button class="tab-close" onclick="closeTab('${tabId}')">×</button>
      `;
      
      tab.onclick = function(e) {
        if (!e.target.classList.contains('tab-close')) {
          switchToTab(tabId);
        }
      };
      
      tabBar.insertBefore(tab, newTabBtn);
      
      const contentArea = document.getElementById('content-area');
      iframe = document.createElement('iframe');
      iframe.className = 'proxy-frame';
      iframe.id = `${tabId}-frame`;
      iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";
      iframe.allow = "fullscreen; geolocation; microphone; camera";
      
      iframe.onload = function() {
        hideLoading();
        try {
          if (iframe.contentDocument && iframe.contentDocument.title) {
            tab.querySelector('.tab-title').textContent = iframe.contentDocument.title || 'Untitled';
          }
        } catch (e) {
          tab.querySelector('.tab-title').textContent = 'Untitled';
        }
        
        // Try to intercept link clicks to open in new tabs
        setupLinkInterception(iframe);
      };
      
      contentArea.appendChild(iframe);
      switchToTab(tabId);
    } else {
      // Update existing tab
      tab.querySelector('.tab-title').textContent = 'Loading...';
      tab.querySelector('.tab-favicon').src = getFavicon(url);
    }
    
    showLoading();
    iframe.src = getProxyUrl(url);
    document.getElementById('address-bar').value = url;
    document.getElementById('welcome-screen').style.display = 'none';
  }).catch(err => {
    console.error('Failed to register service worker:', err);
    alert('Failed to initialize proxy. Please refresh the page.');
  });
}

// Handle address bar submit
function handleAddressSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('address-bar').value.trim();
  if (input) {
    const url = search(input, searchEngineUrl);
    openProxyPage(url);
  }
  return false;
}

// Navigation functions
function goBack() {
  const iframe = document.querySelector('.proxy-frame.active');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.history.back();
    } catch (e) {
      console.log('Cannot go back');
    }
  }
}

function goForward() {
  const iframe = document.querySelector('.proxy-frame.active');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.history.forward();
    } catch (e) {
      console.log('Cannot go forward');
    }
  }
}

function refreshPage() {
  const iframe = document.querySelector('.proxy-frame.active');
  if (iframe) {
    showLoading();
    iframe.src = iframe.src;
  }
}

// Setup link interception for opening in new tabs
function setupLinkInterception(iframe) {
  try {
    if (!iframe.contentDocument) return;
    
    // Inject script to handle target="_blank" and middle clicks
    const script = iframe.contentDocument.createElement('script');
    script.textContent = `
      (function() {
        // Listen for clicks with target="_blank" or middle button
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (!link) return;
          
          const target = link.getAttribute('target');
          const isMiddleClick = e.button === 1;
          const isCtrlClick = e.ctrlKey || e.metaKey;
          
          // If it's meant to open in new tab/window
          if (target === '_blank' || isMiddleClick || isCtrlClick) {
            e.preventDefault();
            e.stopPropagation();
            
            const href = link.href;
            if (href) {
              window.parent.postMessage({
                type: 'open-new-tab',
                url: href
              }, '*');
            }
          }
        }, true);
        
        // Also handle middle button mouse down
        document.addEventListener('mousedown', function(e) {
          if (e.button === 1) {
            const link = e.target.closest('a');
            if (link && link.href) {
              e.preventDefault();
            }
          }
        }, true);
      })();
    `;
    iframe.contentDocument.head.appendChild(script);
  } catch (e) {
    // CORS prevents access, can't inject
    console.log('Cannot inject link interceptor due to CORS');
  }
}

// Listen for messages from iframes
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'open-new-tab' && event.data.url) {
    // Create a new tab with the URL
    const newTabId = `tab-${++tabCounter}`;
    const tabBar = document.getElementById('tab-bar');
    const newTabBtn = tabBar.querySelector('.new-tab-btn');
    
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.id = newTabId;
    tab.innerHTML = `
      <img class="tab-favicon" src="${getFavicon(event.data.url)}" alt="">
      <span class="tab-title">Loading...</span>
      <button class="tab-close" onclick="closeTab('${newTabId}')">×</button>
    `;
    
    tab.onclick = function(e) {
      if (!e.target.classList.contains('tab-close')) {
        switchToTab(newTabId);
      }
    };
    
    tabBar.insertBefore(tab, newTabBtn);
    
    const contentArea = document.getElementById('content-area');
    const iframe = document.createElement('iframe');
    iframe.className = 'proxy-frame';
    iframe.id = `${newTabId}-frame`;
    iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";
    iframe.allow = "fullscreen; geolocation; microphone; camera";
    
    iframe.onload = function() {
      hideLoading();
      try {
        if (iframe.contentDocument && iframe.contentDocument.title) {
          tab.querySelector('.tab-title').textContent = iframe.contentDocument.title || 'Untitled';
        }
      } catch (e) {
        tab.querySelector('.tab-title').textContent = 'Untitled';
      }
      
      setupLinkInterception(iframe);
    };
    
    contentArea.appendChild(iframe);
    
    showLoading();
    iframe.src = getProxyUrl(event.data.url);
    
    // Switch to the new tab
    switchToTab(newTabId);
  }
});

// Handle welcome screen search
function handleWelcomeSearch(event) {
  event.preventDefault();
  const input = document.getElementById('welcome-search-input').value.trim();
  if (input) {
    const url = search(input, searchEngineUrl);
    openProxyPage(url);
    document.getElementById('welcome-search-input').value = '';
  }
  return false;
}

// Loading indicator
function showLoading() {
  document.getElementById('loading-indicator').classList.add('loading');
}

function hideLoading() {
  document.getElementById('loading-indicator').classList.remove('loading');
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  console.log('Proxy browser loaded');
  
  // Create initial tab
  createNewTab();
});
