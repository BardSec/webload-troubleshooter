// panel.js — Drives the WebLoad DevTools panel UI

const tabId = chrome.devtools.inspectedWindow.tabId;
let currentTab = "failures";
let currentData = null;
let filterText = "";

// ── Data fetching ──────────────────────────────────────────────

function fetchData() {
  chrome.runtime.sendMessage({ type: "GET_TAB_DATA", tabId }, (data) => {
    if (chrome.runtime.lastError) {
      console.warn("WebLoad: could not reach background", chrome.runtime.lastError.message);
      return;
    }
    currentData = data;
    render();
  });
}

function clearData() {
  chrome.runtime.sendMessage({ type: "CLEAR_TAB_DATA", tabId }, () => {
    fetchData();
  });
}

// ── Rendering ──────────────────────────────────────────────────

function render() {
  if (!currentData) return;
  updateBadges();
  updateSummary();
  renderTable();
}

function updateBadges() {
  document.getElementById("badge-failures").textContent = currentData.failures.length;
  document.getElementById("badge-csp").textContent = currentData.cspViolations.length;
  document.getElementById("badge-errors").textContent = currentData.jsErrors.length;
  document.getElementById("badge-all").textContent = currentData.requests.length;
}

function updateSummary() {
  const bar = document.getElementById("summary-bar");
  const total = currentData.requests.length;
  const failed = currentData.failures.length;
  const csp = currentData.cspViolations.length;
  const jsErr = currentData.jsErrors.length;
  const nonOk = currentData.requests.filter((r) => r.statusCode >= 400).length;

  bar.innerHTML = `
    <span><span class="stat">${total}</span> requests</span>
    <span><span class="stat error">${failed}</span> blocked/failed</span>
    <span><span class="stat error">${nonOk}</span> HTTP errors</span>
    <span><span class="stat error">${csp}</span> CSP violations</span>
    <span><span class="stat error">${jsErr}</span> JS errors</span>
  `;
}

function renderTable() {
  const container = document.getElementById("panel-content");
  const filter = filterText.toLowerCase();

  if (currentTab === "failures") {
    const rows = currentData.failures.filter((r) => matchFilter(r, filter));
    if (rows.length === 0) {
      container.innerHTML = `<div class="empty-state">No blocked or failed requests detected.</div>`;
      return;
    }
    container.innerHTML = `
      <table>
        <thead><tr>
          <th>Type</th>
          <th>Error</th>
          <th>URL</th>
        </tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <td>${esc(r.type)}</td>
            <td class="status-error">${esc(r.error)}</td>
            <td class="url-cell" title="${esc(r.url)}">${esc(r.url)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  } else if (currentTab === "csp") {
    const rows = currentData.cspViolations.filter((r) => matchFilter(r, filter));
    if (rows.length === 0) {
      container.innerHTML = `<div class="empty-state">No CSP violations detected.</div>`;
      return;
    }
    container.innerHTML = `
      <table>
        <thead><tr>
          <th>Directive</th>
          <th>Blocked URI</th>
          <th>Source</th>
        </tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <td class="status-warn">${esc(r.violatedDirective)}</td>
            <td class="url-cell" title="${esc(r.blockedURI)}">${esc(r.blockedURI)}</td>
            <td class="url-cell">${esc(r.sourceFile || "")}${r.lineNumber ? ":" + r.lineNumber : ""}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  } else if (currentTab === "errors") {
    const rows = currentData.jsErrors.filter((r) => matchFilter(r, filter));
    if (rows.length === 0) {
      container.innerHTML = `<div class="empty-state">No JavaScript errors detected.</div>`;
      return;
    }
    container.innerHTML = `
      <table>
        <thead><tr>
          <th>Error</th>
          <th>Source</th>
          <th>Line</th>
        </tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <td class="status-error">${esc(r.message)}</td>
            <td class="url-cell" title="${esc(r.source || "")}">${esc(r.source || "")}</td>
            <td>${r.line || ""}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  } else if (currentTab === "all") {
    const rows = currentData.requests.filter((r) => matchFilter(r, filter));
    if (rows.length === 0) {
      container.innerHTML = `<div class="empty-state">No requests captured yet. Navigate or reload the page.</div>`;
      return;
    }
    container.innerHTML = `
      <table>
        <thead><tr>
          <th>Status</th>
          <th>Type</th>
          <th>URL</th>
          <th>CSP</th>
        </tr></thead>
        <tbody>${rows.map((r) => {
          const cls = r.statusCode >= 400 ? "status-error" : r.statusCode >= 300 ? "status-warn" : "status-ok";
          return `
          <tr>
            <td class="${cls}">${r.statusCode}</td>
            <td>${esc(r.type)}</td>
            <td class="url-cell" title="${esc(r.url)}">${esc(r.url)}</td>
            <td style="max-width:200px" title="${esc(r.csp || "")}">${esc(r.csp || "—")}</td>
          </tr>`;
        }).join("")}
        </tbody>
      </table>`;
  }
}

// ── CSV Export ─────────────────────────────────────────────────

function formatTimestamp(ts) {
  if (!ts) return "";
  return new Date(ts).toISOString();
}

function getTabRows(tabName, data, filter) {
  if (tabName === "failures") {
    return {
      headers: ["Timestamp", "Type", "Error", "URL"],
      rows: data.failures.filter((r) => matchFilter(r, filter))
        .map((r) => [formatTimestamp(r.timestamp), r.type, r.error, r.url]),
    };
  } else if (tabName === "csp") {
    return {
      headers: ["Timestamp", "Directive", "Blocked URI", "Source", "Line", "Column"],
      rows: data.cspViolations.filter((r) => matchFilter(r, filter))
        .map((r) => [formatTimestamp(r.timestamp), r.violatedDirective, r.blockedURI, r.sourceFile || "", r.lineNumber || "", r.columnNumber || ""]),
    };
  } else if (tabName === "errors") {
    return {
      headers: ["Timestamp", "Error", "Source", "Line", "Column"],
      rows: data.jsErrors.filter((r) => matchFilter(r, filter))
        .map((r) => [formatTimestamp(r.timestamp), r.message, r.source || "", r.line || "", r.col || ""]),
    };
  } else if (tabName === "all") {
    return {
      headers: ["Timestamp", "Status", "Type", "URL", "From Cache", "IP", "CSP"],
      rows: data.requests.filter((r) => matchFilter(r, filter))
        .map((r) => [formatTimestamp(r.timestamp), r.statusCode, r.type, r.url, r.fromCache ? "Yes" : "No", r.ip || "", r.csp || ""]),
    };
  }
  return { headers: [], rows: [] };
}

function buildCSV(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(","))
    .join("\n");
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV() {
  if (!currentData) return;
  const filter = filterText.toLowerCase();
  const { headers, rows } = getTabRows(currentTab, currentData, filter);
  if (rows.length === 0) return;

  const csvContent = buildCSV(headers, rows);
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  downloadCSV(csvContent, `webload-${currentTab}-${ts}.csv`);
}

function exportAllCSV() {
  if (!currentData) return;
  const filter = filterText.toLowerCase();
  const sections = [
    { name: "Blocked/Failed Requests", tab: "failures" },
    { name: "CSP Violations", tab: "csp" },
    { name: "JS Errors", tab: "errors" },
    { name: "All Requests", tab: "all" },
  ];

  let allLines = [];
  for (const section of sections) {
    const { headers, rows } = getTabRows(section.tab, currentData, filter);
    if (rows.length === 0) continue;
    allLines.push(`"--- ${section.name} (${rows.length}) ---"`);
    allLines.push(headers.map((h) => '"' + h + '"').join(","));
    for (const row of rows) {
      allLines.push(row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(","));
    }
    allLines.push("");
  }

  if (allLines.length === 0) return;
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  downloadCSV(allLines.join("\n"), `webload-all-${ts}.csv`);
}

// ── Helpers ────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function matchFilter(obj, filter) {
  if (!filter) return true;
  return JSON.stringify(obj).toLowerCase().includes(filter);
}

// ── Event wiring ───────────────────────────────────────────────

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    renderTable();
  });
});

document.getElementById("btn-refresh").addEventListener("click", fetchData);
document.getElementById("btn-clear").addEventListener("click", clearData);
document.getElementById("btn-export").addEventListener("click", exportCSV);
document.getElementById("btn-export-all").addEventListener("click", exportAllCSV);

document.getElementById("filter-input").addEventListener("input", (e) => {
  filterText = e.target.value;
  renderTable();
});

// Auto-refresh every 2 seconds while the panel is open
fetchData();
setInterval(fetchData, 2000);
