// ---- Word Bag State ----
let wordBag = [];
let highlightElements = [];
let bagCounter = null;

// Debounce timer
let debounceTimer = null;
let pendingAbort = null;

// Current dynamic settings
let currentSettings = {
  triggerMode: 'keyboard-only',
  popupDelay: 300,
  maxTextLength: 5000
};

// ---- Init ----
async function init() {
  // Load initial settings
  Object.assign(currentSettings, await getSettings());

  // Always listen for keyboard shortcut triggers
  window.addEventListener('wt-retry', () => {
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (text) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      doTranslate(text, rect, false);
    }
  });

  // Set up mouseup listener based on current trigger mode
  setupAutoTrigger();

  // Listen for settings changes from options page
  browserAPI.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    let needsReinit = false;
    if (changes.triggerMode) {
      currentSettings.triggerMode = changes.triggerMode.newValue;
      needsReinit = true;
    }
    if (changes.popupDelay) {
      currentSettings.popupDelay = changes.popupDelay.newValue;
      needsReinit = true;
    }
    if (changes.maxTextLength) {
      currentSettings.maxTextLength = changes.maxTextLength.newValue;
    }
    if (needsReinit) setupAutoTrigger();
  });
}

let autoTriggerHandler = null;

function setupAutoTrigger() {
  // Remove old listener if exists
  if (autoTriggerHandler) {
    document.removeEventListener('mouseup', autoTriggerHandler);
    autoTriggerHandler = null;
  }

  if (currentSettings.triggerMode !== 'auto') return;

  autoTriggerHandler = e => {
    if (e.target.closest('#wt-popup-host')) return;

    // Skip input, textarea, and contenteditable elements
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;

    if (e.ctrlKey) {
      const el = e.target.closest('a, button, [role="button"]');
      if (el) {
        const text = el.textContent.trim();
        if (text.length >= 2 && text.length <= (currentSettings.maxTextLength || 5000)) {
          clearTimeout(debounceTimer);
          doTranslate(text, el.getBoundingClientRect(), false);
          return;
        }
      }
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel.toString().trim();
      if (text.length < 2 || text.length > (currentSettings.maxTextLength || 5000)) return;

      const rect = sel.getRangeAt(0).getBoundingClientRect();
      doTranslate(text, rect, false);
    }, currentSettings.popupDelay || 300);
  };

  document.addEventListener('mouseup', autoTriggerHandler);
}

// ---- Translation Flow ----
async function doTranslate(text, rect, skipDetect) {
  hidePopup();
  if (pendingAbort) pendingAbort.abort();
  pendingAbort = new AbortController();

  await showLoading(rect, () => {
    hidePopup();
    if (pendingAbort) pendingAbort.abort();
  });

  try {
    let result;

    if (wordBag.length > 0) {
      // Word bag mode
      result = await browserAPI.runtime.sendMessage({ action: 'translate-wordbag', wordBag: wordBag.map(w => ({ text: w.text })) });

      // Save history for each word
      if (result.isPhrase && result.combined) {
        await browserAPI.runtime.sendMessage({
          action: 'add-history',
          entry: { original: wordBag.map(w => w.text).join(' '), translated: result.combined, sourceLang: result.sourceLang, targetLang: result.targetLang }
        });
      } else {
        for (const w of result.words) {
          await browserAPI.runtime.sendMessage({
            action: 'add-history',
            entry: { original: w.original, translated: w.translated, sourceLang: result.sourceLang, targetLang: result.targetLang }
          });
        }
      }

      const combinedText = wordBag.map(w => w.text).join(' ');
      if (pendingAbort.signal.aborted) return;
      showResult(rect, { error: null, wordBag: result, fromCache: false }, combinedText, true);
    } else {
      // Normal mode
      result = await browserAPI.runtime.sendMessage({ action: 'translate', text, skipDetect });

      if (!result.success) throw new Error(result.error);

      // Save history
      await browserAPI.runtime.sendMessage({
        action: 'add-history',
        entry: { original: text, translated: result.translated, sourceLang: result.sourceLang, targetLang: result.targetLang }
      });

      if (pendingAbort.signal.aborted) return;
      showResult(rect, result, text, false);
    }
  } catch (e) {
    if (e.name === 'AbortError' || pendingAbort.signal.aborted) return;
    showError(rect, '翻译失败，请检查网络或稍后重试');
  }
}

// ---- Word Bag Management ----
function toggleWordBag() {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (!text || text.length < 1) return;

  // Check if already in bag
  const idx = wordBag.findIndex(w => w.text === text);
  if (idx >= 0) {
    // Remove
    wordBag.splice(idx, 1);
    removeHighlight(idx);
  } else {
    // Add
    const range = sel.getRangeAt(0);
    wordBag.push({ text, range: range.cloneRange() });
    addHighlight(range, wordBag.length - 1);
  }
  updateBagCounter();
}

function addHighlight(range, idx) {
  if (!range) return;
  const rects = range.getClientRects();
  for (const rect of rects) {
    const span = document.createElement('span');
    span.className = 'wt-highlight';
    span.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;background:rgba(250,204,21,0.35);border-bottom:2px solid rgba(234,179,8,0.6);transition:opacity 0.1s;`;
    span.style.top = rect.top + 'px';
    span.style.left = rect.left + 'px';
    span.style.width = rect.width + 'px';
    span.style.height = rect.height + 'px';
    document.body.appendChild(span);
    highlightElements.push(span);
  }
}

function removeHighlight(idx) {
  clearHighlights();
  wordBag.forEach((w, i) => {
    if (i !== idx) addHighlight(w.range, i);
  });
}

function clearWordBag() {
  wordBag = [];
  clearHighlights();
  if (bagCounter) { bagCounter.remove(); bagCounter = null; }
}

function clearHighlights() {
  highlightElements.forEach(el => el.remove());
  highlightElements = [];
}

function updateBagCounter() {
  if (!bagCounter) {
    bagCounter = document.createElement('div');
    bagCounter.style.cssText = 'position:fixed;z-index:2147483646;top:12px;right:12px;background:#2563eb;color:#fff;font-size:12px;padding:4px 10px;border-radius:20px;font-family:sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
    bagCounter.addEventListener('click', clearWordBag);
    document.body.appendChild(bagCounter);
  }
  bagCounter.textContent = `词袋: ${wordBag.length} 个词`;
  if (wordBag.length === 0 && bagCounter) {
    bagCounter.remove();
    bagCounter = null;
  }
}

// ---- Message Listener (from background) ----
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const sel = window.getSelection();
  const text = sel.toString().trim();

  if (request.action === 'trigger-translate') {
    const t = request.text || text;
    const rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : { top: 100, bottom: 120, left: 100, right: 200, width: 100 };
    doTranslate(t, rect, false);
    sendResponse({ ok: true });
  }

  if (request.action === 'trigger-fast-translate') {
    const t = text;
    const rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : { top: 100, bottom: 120, left: 100, right: 200, width: 100 };
    doTranslate(t, rect, true);
    sendResponse({ ok: true });
  }

  if (request.action === 'wordbag-toggle') {
    toggleWordBag();
    sendResponse({ ok: true });
  }

  if (request.action === 'wordbag-add') {
    if (request.text && request.text.trim()) {
      wordBag.push({ text: request.text.trim(), range: null });
      updateBagCounter();
    }
    sendResponse({ ok: true });
  }

  if (request.action === 'wordbag-clear') {
    clearWordBag();
    sendResponse({ ok: true });
  }
});

// ---- Init on load ----
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
