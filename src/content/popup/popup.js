// Floating popup with Shadow DOM isolation
let popupHost = null;
let popupRoot = null;
let showingHistory = false;
let isPinned = false;
let dragState = null;
let resizeState = null;
let cachedCSS = null;

// Fetch CSS once and cache it
async function getCSS() {
  if (cachedCSS) return cachedCSS;
  try {
    const url = chrome.runtime.getURL('src/content/popup/popup.css');
    const res = await fetch(url);
    cachedCSS = await res.text();
    return cachedCSS;
  } catch (e) {
    console.error('WT: Failed to load CSS', e);
    return '';
  }
}

function ensurePopupHost() {
  if (popupHost && popupHost.isConnected) return;
  popupHost = document.createElement('div');
  popupHost.id = 'wt-popup-host';
  popupHost.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(popupHost);
  popupRoot = popupHost.attachShadow({ mode: 'closed' });
}

function detectDarkMode() {
  const bg = window.getComputedStyle(document.body).backgroundColor;
  const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;
  const luminance = 0.299 * (+match[1]) + 0.587 * (+match[2]) + 0.114 * (+match[3]);
  return luminance < 100;
}

function calcPosition(rect) {
  const margin = 10;
  // Estimate popup width; actual will be set by CSS fit-content
  const estW = 280;
  let top = rect.bottom + margin;
  let left = Math.max(margin, Math.min(rect.left + rect.width / 2 - estW / 2, window.innerWidth - estW - margin));
  if (top + 120 > window.innerHeight) {
    top = rect.top - margin - 80;
    if (top < margin) top = margin;
  }
  return { top: Math.round(top), left: Math.round(left) };
}

// ---- Drag ----
function startDrag(e) {
  if (e.target.closest('button')) return;
  e.preventDefault();
  dragState = {
    startX: e.clientX, startY: e.clientY,
    origLeft: parseInt(popupHost.style.left) || 0,
    origTop: parseInt(popupHost.style.top) || 0
  };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(e) {
  if (!dragState) return;
  const popupW = popupHost.getBoundingClientRect().width;
  popupHost.style.left = Math.max(0, Math.min(dragState.origLeft + e.clientX - dragState.startX, window.innerWidth - popupW)) + 'px';
  popupHost.style.top = Math.max(0, Math.min(dragState.origTop + e.clientY - dragState.startY, window.innerHeight - 60)) + 'px';
}

function stopDrag() {
  dragState = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

function startResize(e) {
  e.preventDefault();
  e.stopPropagation();
  const container = popupRoot.querySelector('.container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  resizeState = {
    startX: e.clientX,
    startY: e.clientY,
    origW: rect.width,
    origH: rect.height
  };
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
}

function onResize(e) {
  if (!resizeState) return;
  const container = popupRoot.querySelector('.container');
  if (!container) return;
  const newW = Math.max(120, Math.min(resizeState.origW + e.clientX - resizeState.startX, window.innerWidth - 20));
  const newH = Math.max(60, Math.min(resizeState.origH + e.clientY - resizeState.startY, window.innerHeight - 20));
  container.style.width = newW + 'px';
  container.style.minWidth = newW + 'px';
  container.style.maxWidth = newW + 'px';
  container.style.height = newH + 'px';
  container.style.minHeight = newH + 'px';
  container.style.maxHeight = newH + 'px';
  container.offsetWidth;
}

function stopResize() {
  resizeState = null;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
}

// ---- Public API ----
async function showLoading(rect, onCancel) {
  isPinned = false;
  ensurePopupHost();
  const pos = calcPosition(rect);
  popupHost.style.cssText = `position:fixed;z-index:2147483647;pointer-events:auto;top:${pos.top}px;left:${pos.left}px;`;

  const css = await getCSS();
  const isDark = detectDarkMode();
  popupRoot.innerHTML = `
    <style>${css}</style>
    <div class="container ${isDark ? 'dark' : ''}">
      <div class="drag-handle"><span class="dots">⋮⋮</span><span>拖拽移动</span><button class="btn pin-btn" title="固定浮窗">📌</button></div>
      <div class="spinner">翻译中...</div>
    </div>`;

  const container = popupRoot.querySelector('.container');
  container.querySelector('.drag-handle').addEventListener('mousedown', startDrag);
  container.addEventListener('click', (e) => {
    if (!e.target.closest('.drag-handle')) {
      hidePopup();
      if (onCancel) onCancel();
    }
  });
}

async function showResult(rect, data, originalText, wordBagMode) {
  ensurePopupHost();
  const pos = calcPosition(rect);
  const top = popupHost.style.top || pos.top + 'px';
  const left = popupHost.style.left || pos.left + 'px';
  popupHost.style.cssText = `position:fixed;z-index:2147483647;pointer-events:auto;top:${top};left:${left};`;
  showingHistory = false;

  const css = await getCSS();
  const isDark = detectDarkMode();
  const langLabel = data.sourceLang === 'zh-CN' ? '中 → 英' : '英 → 中';

  let bodyHTML = '';

  if (data.error) {
    bodyHTML = `<div class="error">${data.error}<br><button class="btn retry-btn" style="margin-top:8px;color:var(--popup-accent);">🔄 重试</button></div>`;
  } else if (wordBagMode && data.wordBag) {
    const { isPhrase, combined, words } = data.wordBag;
    bodyHTML = `<div class="header"><span class="lang-badge">${langLabel}</span>${isPhrase ? '<span class="phrase-badge">检测到词组</span>' : ''}</div>`;
    if (isPhrase && combined) {
      bodyHTML += `<div class="original-text">${escapeHtml(originalText)}</div><div class="translated-text">${escapeHtml(combined)}</div>`;
    }
    bodyHTML += `<div class="word-list">${words.map(w => `<div class="word-row"><span class="orig">${escapeHtml(w.original)}</span><span>${escapeHtml(w.translated)}</span></div>`).join('')}</div>`;
  } else {
    bodyHTML = `<div class="header"><span class="lang-badge">${langLabel}</span>${data.fromCache ? '<span style="font-size:10px;color:var(--popup-sub);">缓存</span>' : ''}</div>
      <div class="original-text">${escapeHtml(originalText)}</div>
      <div class="translated-text">${escapeHtml(data.translated)}</div>`;
  }

  popupRoot.innerHTML = `
    <style>${css}</style>
    <div class="container ${isDark ? 'dark' : ''}">
      <div class="drag-handle"><span class="dots">⋮⋮</span><span>拖拽移动</span><button class="btn pin-btn" title="固定浮窗">📌</button></div>
      <div class="scroll-area">${bodyHTML}</div>
      <div class="actions">
        <button class="btn copy-btn">📋 复制</button>
        <button class="btn speak-btn">🔊 读译文</button>
        <button class="btn speak-orig-btn">🗣 读原文</button>
        <button class="btn history-btn">⏳ 历史</button>
        <button class="btn close-btn">✕</button>
      </div>
      <div class="resize-grip"></div>
      <div class="history-panel" style="display:none;"></div>
    </div>`;

  const container = popupRoot.querySelector('.container');
  container.querySelector('.drag-handle').addEventListener('mousedown', startDrag);
  container.querySelector('.resize-grip').addEventListener('mousedown', startResize);
  container.querySelector('.close-btn').addEventListener('click', hidePopup);
  container.addEventListener('click', (e) => {
    if (isPinned) return;
    if (e.target.closest('button')) return;
    if (e.target.closest('.drag-handle')) return;
    if (e.target.closest('.resize-grip')) return;
    if (e.target.closest('.history-panel')) return;
    hidePopup();
  });
  container.querySelector('.pin-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    isPinned = !isPinned;
    const btn = e.target;
    if (isPinned) {
      btn.textContent = '📍';
      btn.title = '取消固定';
      btn.classList.add('pinned');
    } else {
      btn.textContent = '📌';
      btn.title = '固定浮窗';
      btn.classList.remove('pinned');
    }
  });
  container.querySelector('.copy-btn').addEventListener('click', () => {
    const text = data.translated || (data.wordBag ? (data.wordBag.combined || data.wordBag.words.map(w => w.original + ' → ' + w.translated).join('\n')) : '');
    navigator.clipboard.writeText(text);
  });
  container.querySelector('.speak-btn').addEventListener('click', () => {
    const text = data.translated || (data.wordBag && data.wordBag.combined) || '';
    if (text) speak(text, data.targetLang || 'en');
  });
  container.querySelector('.speak-orig-btn').addEventListener('click', () => {
    const text = originalText || (data.wordBag && data.wordBag.combined) || '';
    if (text) speak(text, data.sourceLang || 'en');
  });
  container.querySelector('.history-btn').addEventListener('click', toggleHistoryPanel);
  container.querySelector('.retry-btn')?.addEventListener('click', () => {
    hidePopup();
    window.dispatchEvent(new CustomEvent('wt-retry'));
  });

  // Click on translated or original text dismisses popup
  const translatedEl = container.querySelector('.translated-text');
  const originalEl = container.querySelector('.original-text');
  if (translatedEl) {
    translatedEl.style.cursor = 'pointer';
    translatedEl.title = '点击关闭';
    translatedEl.addEventListener('click', () => { if (!isPinned) hidePopup(); });
  }
  if (originalEl) {
    originalEl.style.cursor = 'pointer';
    originalEl.title = '点击关闭';
    originalEl.addEventListener('click', () => { if (!isPinned) hidePopup(); });
  }
}

async function toggleHistoryPanel(e) {
  const panel = popupRoot.querySelector('.history-panel');
  if (!panel) return;
  showingHistory = !showingHistory;
  if (showingHistory) {
    await loadHistory(panel);
    panel.style.display = 'block';
    e.target.textContent = '✕ 关闭';
  } else {
    panel.style.display = 'none';
    e.target.textContent = '⏳ 历史';
  }
}

async function loadHistory(panel) {
  panel.innerHTML = '<div class="spinner">加载中...</div>';
  try {
    const history = await chrome.runtime.sendMessage({ action: 'get-history' });
    if (!history || history.length === 0) {
      panel.innerHTML = '<div style="padding:12px;color:var(--popup-sub);text-align:center;">暂无历史</div>';
      return;
    }
    panel.innerHTML = history.map((h, i) => `
      <div class="history-item" data-idx="${i}">
        <div class="orig">${escapeHtml(h.original)}</div>
        <div class="trans">${escapeHtml(h.translated)}</div>
      </div>`).join('');
    panel.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const h = history[parseInt(item.dataset.idx)];
        if (h) showResult(popupHost.getBoundingClientRect(), { translated: h.translated, sourceLang: h.sourceLang, targetLang: h.targetLang, fromCache: false }, h.original, false);
      });
    });
  } catch (e) {
    panel.innerHTML = '<div style="padding:12px;color:var(--popup-sub);text-align:center;">加载失败</div>';
  }
}

function showError(rect, message) {
  showResult(rect, { error: message }, '', false);
}

function hidePopup() {
  if (dragState) stopDrag();
  if (resizeState) stopResize();
  if (popupHost) { popupHost.remove(); popupHost = null; popupRoot = null; }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
