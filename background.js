// background.js — Service worker that tracks network requests per tab

const tabData = new Map();

function getTabData(tabId) {
  if (!tabData.has(tabId)) {
    tabData.set(tabId, {
      requests: [],
      failures: [],
      cspViolations: [],
      jsErrors: [],
    });
  }
  return tabData.get(tabId);
}

// Listen for network request completions to capture response status and headers
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const data = getTabData(details.tabId);
    const entry = {
      url: details.url,
      type: details.type,
      statusCode: details.statusCode,
      fromCache: details.fromCache,
      ip: details.ip || null,
      timestamp: details.timeStamp,
    };

    // Track CSP-related headers
    if (details.responseHeaders) {
      const cspHeader = details.responseHeaders.find(
        (h) => h.name.toLowerCase() === "content-security-policy"
      );
      if (cspHeader) {
        entry.csp = cspHeader.value;
      }
    }

    data.requests.push(entry);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Listen for failed requests (blocked, timed out, DNS failures, etc.)
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const data = getTabData(details.tabId);
    data.failures.push({
      url: details.url,
      type: details.type,
      error: details.error,
      timestamp: details.timeStamp,
    });
  },
  { urls: ["<all_urls>"] }
);

// Clear data when a tab navigates to a new page
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type === "main_frame") {
      tabData.set(details.tabId, {
        requests: [],
        failures: [],
        cspViolations: [],
        jsErrors: [],
      });
    }
  },
  { urls: ["<all_urls>"] }
);

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabData.delete(tabId);
});

// Handle messages from devtools panel and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_DATA") {
    const data = getTabData(message.tabId);
    sendResponse(data);
    return true;
  }

  if (message.type === "CLEAR_TAB_DATA") {
    tabData.set(message.tabId, {
      requests: [],
      failures: [],
      cspViolations: [],
      jsErrors: [],
    });
    sendResponse({ ok: true });
    return true;
  }

  // Content script reports — use sender.tab.id to attribute to the right tab
  if (message.type === "CSP_VIOLATION" && sender.tab) {
    const data = getTabData(sender.tab.id);
    data.cspViolations.push(message.payload);
    return;
  }

  if (message.type === "JS_ERROR" && sender.tab) {
    const data = getTabData(sender.tab.id);
    data.jsErrors.push(message.payload);
    return;
  }
});
