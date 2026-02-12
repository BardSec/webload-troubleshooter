# WebLoad Troubleshooter

Chrome extension that surfaces page-load problems caused by content filters, blocked scripts, CSP policies, and broken dependencies — all from a DevTools panel.

## What it detects

- **Blocked / failed network requests** — scripts, stylesheets, images, or fonts that were blocked by a content filter, proxy, or firewall (captured via `chrome.webRequest.onErrorOccurred`)
- **HTTP error responses** — 4xx and 5xx status codes on any sub-resource
- **Content-Security-Policy violations** — inline scripts, eval, or remote resources blocked by CSP headers (captured via the `securitypolicyviolation` DOM event)
- **JavaScript runtime errors** — uncaught exceptions and unhandled promise rejections that may result from missing dependencies

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select this project folder
5. Open DevTools (F12) on any page — a new **WebLoad** panel will appear

## Usage

1. Navigate to the page you want to troubleshoot
2. Open DevTools and select the **WebLoad** tab
3. The panel has four views:
   - **Blocked / Failed** — requests that never completed (DNS failures, connection resets, net::ERR_BLOCKED_BY_CLIENT, etc.)
   - **CSP Violations** — resources blocked by Content-Security-Policy with the violated directive and blocked URI
   - **JS Errors** — runtime JavaScript errors with source file and line number
   - **All Requests** — every completed request with status code and CSP header info
4. Use the filter bar to search across any column
5. Click **Refresh** to pull latest data, or **Clear** to reset

## Project structure

```
manifest.json   — Extension manifest (Manifest V3)
background.js   — Service worker: captures network events via webRequest API
content.js      — Content script: listens for CSP violations and JS errors
devtools.html   — DevTools page entry point
devtools.js     — Creates the WebLoad panel
panel.html      — Panel UI markup and styles
panel.js        — Panel logic: fetches data from background, renders tables
icons/          — Extension icons (16, 48, 128px)
```
