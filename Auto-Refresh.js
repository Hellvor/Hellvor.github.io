// This script checks for changes in the main HTML structure and reloads the page if a difference is detected.
// It works by periodically fetching the source HTML for the current page
// and comparing its structure (ignoring dynamic content) to the current DOM.

// ====== CONFIGURATION ======
const CHECK_INTERVAL_MS = 5000; // How often to check for changes (5 seconds recommended)
const IGNORE_DYNAMIC_ATTRIBUTES = ['data-', 'aria-', 'style', 'class', 'id']; // Ignore these to reduce false positives

// ====== CORE LOGIC ======

// Serialize DOM to a string that ignores dynamic content and attributes
function serializeDOM(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return ''; // Ignore text nodes for structure check
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  let tag = node.tagName.toLowerCase();
  let attrs = [];
  for (let attr of node.attributes) {
    if (
      !IGNORE_DYNAMIC_ATTRIBUTES.some(ignore =>
        attr.name.startsWith(ignore)
      )
    ) {
      attrs.push(`${attr.name}="${attr.value}"`);
    }
  }
  attrs.sort();
  let children = Array.from(node.childNodes)
    .map(serializeDOM)
    .join('');
  return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${children}</${tag}>`;
}

// Fetch the latest HTML for the current page
async function fetchPageHTML() {
  const url = window.location.href;
  const response = await fetch(url, {
    cache: 'reload'
  });
  return await response.text();
}

// Extract and serialize the <body> from HTML string
function extractBodySerialized(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return serializeDOM(doc.body);
}

async function checkForChangesAndReload() {
  try {
    const currentSerialized = serializeDOM(document.body);
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
