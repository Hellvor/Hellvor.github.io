// This script checks for ANY changes in the HTML content of the current page (including dynamic content),
// and reloads the page if a difference is detected. It compares the entire <body> (structure + text + attributes)
// with a fresh version fetched from the server.

// ====== CONFIGURATION ======
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

// Serialize the full DOM, including all node types, attributes, and text
function serializeFullDOM(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  let tag = node.tagName.toLowerCase();
  let attrs = [];
  for (let attr of node.attributes) {
    attrs.push(`${attr.name}="${attr.value}"`);
  }
  attrs.sort();
  let children = Array.from(node.childNodes)
    .map(serializeFullDOM)
    .join('');
  return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${children}</${tag}>`;
}

// Fetch the latest HTML for the current page
async function fetchPageHTML() {
  const url = window.location.href;
  const response = await fetch(url, { cache: 'reload' });
  return await response.text();
}

// Extract and serialize the <body> from HTML string
function extractBodySerialized(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return serializeFullDOM(doc.body);
}

async function checkForChangesAndReload() {
  try {
    const currentSerialized = serializeFullDOM(document.body);
    const html = await fetchPageHTML();
    const fetchedSerialized = extractBodySerialized(html);

    if (currentSerialized !== fetchedSerialized) {
      console.log('[Auto-Refresh] Change detected, reloading page...');
      window.location.reload();
    }
  } catch (err) {
    console.warn('[Auto-Refresh] Failed to check for changes:', err);
  }
}

// Start periodic checking
setInterval(checkForChangesAndReload, CHECK_INTERVAL_MS);

// Optional: Run one check on initial load
checkForChangesAndReload();
