// Minimal test to verify extension framework works
try {
  importScripts(
    '../lib/browser-polyfill.js',
    '../lib/md5.js',
    '../lib/lang-detect.js',
    '../lib/text-segmenter.js',
    '../lib/glossary.js',
    '../lib/storage.js',
    '../lib/history.js',
    '../lib/translators/google.js',
    '../lib/translators/youdao.js',
    '../lib/translators/mymemory.js',
    '../lib/translator-manager.js'
  );
  console.log('WT: All imports OK');
} catch (e) {
  console.error('WT IMPORT ERROR:', e.message, 'stack:', e.stack);
}

// Simple ping to verify the worker is alive
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  console.log('WT: got message', req.action);

  if (req.action === 'translate') {
    handleTranslate(req).then(r => { console.log('WT: translate OK'); sendResponse(r); }).catch(e => { console.error('WT: translate failed', e.message); sendResponse({ success: false, error: e.message }); });
    return true;
  }
  if (req.action === 'translate-wordbag') {
    handleWordBag(req).then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (req.action === 'get-history') {
    getHistory().then(sendResponse).catch(() => sendResponse([]));
    return true;
  }
  if (req.action === 'add-history') {
    addHistory(req.entry).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (req.action === 'clear-history') {
    clearHistory().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function handleTranslate(req) {
  if (!req.text) throw new Error('No text');
  const r = await translate(req.text, { skipDetect: req.skipDetect });
  return { success: true, ...r };
}

async function handleWordBag(req) {
  if (!req.wordBag || !req.wordBag.length) throw new Error('Empty bag');
  const r = await translateWordBag(req.wordBag);
  return { success: true, ...r };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'translate-selection', title: '翻译选中文本', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'wordbag-add', title: '加入词袋', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'wordbag-clear', title: '清空词袋', contexts: ['all'] });
  });
  console.log('WT: Context menus created');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const act = { 'translate-selection': 'trigger-translate', 'wordbag-add': 'wordbag-add', 'wordbag-clear': 'wordbag-clear' }[info.menuItemId];
  if (act) {
    chrome.tabs.sendMessage(tab.id, { action: act, text: info.selectionText }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    const map = { 'translate-selection': 'trigger-translate', 'wordbag-toggle': 'wordbag-toggle', 'wordbag-clear': 'wordbag-clear', 'fast-translate': 'trigger-fast-translate' };
    const act = map[cmd];
    if (act) chrome.tabs.sendMessage(tab.id, { action: act }).catch(() => {});
  } catch (e) {
    console.error('WT: command error', e.message);
  }
});

console.log('WT: Service worker ready');
