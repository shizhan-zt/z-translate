const MAX_HISTORY = 20;

async function getHistory() {
  const result = await chrome.storage.local.get('transHistory');
  return result.transHistory || [];
}

async function addHistory(entry) {
  const history = await getHistory();
  // Avoid exact duplicates
  const dup = history.find(h => h.original === entry.original && h.sourceLang === entry.sourceLang);
  if (!dup) {
    history.unshift({ ...entry, time: Date.now() });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    await chrome.storage.local.set({ transHistory: history });
  }
}

async function clearHistory() {
  await chrome.storage.local.set({ transHistory: [] });
}
