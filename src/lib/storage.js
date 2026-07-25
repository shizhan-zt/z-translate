const DEFAULTS = {
  backendOrder: ['mymemory', 'google', 'youdao'],
  apiKeys: {},
  autoDetect: true,
  triggerMode: 'keyboard-only',
  popupDelay: 300,
  fastDirection: 'auto',
  maxTextLength: 5000,
  cacheEnabled: true,
  glossary: {}
};

async function getSettings() {
  const result = await browserAPI.storage.sync.get(DEFAULTS);

  // Migration: ensure mymemory is in backendOrder for China accessibility
  if (!result.backendOrder.includes('mymemory')) {
    result.backendOrder = ['mymemory', ...result.backendOrder];
    await browserAPI.storage.sync.set({ backendOrder: result.backendOrder });
  }

  return result;
}

async function saveSettings(partial) {
  await browserAPI.storage.sync.set(partial);
}

async function getHistory() {
  const result = await browserAPI.storage.local.get('history');
  return result.history || [];
}

async function saveHistory(entry) {
  const history = await getHistory();
  history.unshift({ ...entry, time: Date.now() });
  if (history.length > 20) history.length = 20;
  await browserAPI.storage.local.set({ history });
}

async function getGlossary() {
  const settings = await getSettings();
  return settings.glossary || {};
}

async function saveGlossary(glossary) {
  await browserAPI.storage.sync.set({ glossary });
}

async function getCache() {
  const result = await browserAPI.storage.session.get('cache');
  return result.cache || {};
}

async function setCache(key, value) {
  const cache = await getCache();
  cache[key] = { value, time: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > 500) {
    const oldest = keys.sort((a, b) => cache[a].time - cache[b].time).slice(0, keys.length - 500);
    oldest.forEach(k => delete cache[k]);
  }
  await browserAPI.storage.session.set({ cache });
}

async function getCacheItem(key) {
  const cache = await getCache();
  return cache[key]?.value || null;
}
