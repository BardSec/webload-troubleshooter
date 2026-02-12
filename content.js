// content.js — Captures CSP violations and JS errors from the page and
// forwards them to the background service worker.

// Listen for Content-Security-Policy violation reports
document.addEventListener("securitypolicyviolation", (e) => {
  chrome.runtime.sendMessage({
    type: "CSP_VIOLATION",
    payload: {
      violatedDirective: e.violatedDirective,
      effectiveDirective: e.effectiveDirective,
      blockedURI: e.blockedURI,
      originalPolicy: e.originalPolicy,
      sourceFile: e.sourceFile,
      lineNumber: e.lineNumber,
      columnNumber: e.columnNumber,
      timestamp: Date.now(),
    },
  });
});

// Listen for uncaught JS errors (broken scripts, missing dependencies, etc.)
window.addEventListener("error", (e) => {
  // Only forward script errors, not resource load errors handled by webRequest
  if (e.message) {
    chrome.runtime.sendMessage({
      type: "JS_ERROR",
      payload: {
        message: e.message,
        source: e.filename,
        line: e.lineno,
        column: e.colno,
        timestamp: Date.now(),
      },
    });
  }
});

// Listen for unhandled promise rejections
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  chrome.runtime.sendMessage({
    type: "JS_ERROR",
    payload: {
      message: reason instanceof Error ? reason.message : String(reason),
      source: reason instanceof Error ? reason.stack : null,
      line: null,
      column: null,
      timestamp: Date.now(),
    },
  });
});
