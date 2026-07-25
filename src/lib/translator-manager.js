// Translation orchestrator: backend fallback chain, caching, glossary, segmentation

async function translate(text, options = {}) {
  const settings = await getSettings();
  const { autoDetect, fastDirection, maxTextLength, cacheEnabled, backendOrder } = settings;
  const glossary = settings.glossary || {};

  // Step 1: Language detection
  let sourceLang, targetLang;
  if (options.skipDetect) {
    sourceLang = fastDirection === 'zh2en' ? 'zh-CN' : 'en';
    targetLang = fastDirection === 'zh2en' ? 'en' : 'zh-CN';
  } else {
    sourceLang = detectLang(text);
    targetLang = getTargetLang(sourceLang, fastDirection);
  }

  // Step 2: Check cache
  if (cacheEnabled) {
    const key = cacheKey(text, sourceLang, targetLang);
    const cached = await getCacheItem(key);
    if (cached) return { ...cached, fromCache: true, sourceLang, targetLang };
  }

  // Step 3: Glossary term protection
  const glossaryKeys = Object.keys(glossary);
  let protectedText = text;
  let placeholderMap = {};
  if (glossaryKeys.length > 0) {
    const result = protectTerms(text, glossary);
    protectedText = result.protectedText;
    placeholderMap = result.placeholderMap;
  }

  // Step 4: Segment long text
  const segments = segmentText(protectedText, maxTextLength);

  // Step 5: Translate segments via fallback chain
  let translatedParts = [];
  for (const seg of segments) {
    let translated = null;
    for (const backend of backendOrder) {
      try {
        if (backend === 'google') {
          translated = await translateGoogle(seg, sourceLang, targetLang);
        } else if (backend === 'mymemory') {
          translated = await translateMyMemory(seg, sourceLang, targetLang);
        } else if (backend === 'youdao') {
          translated = await translateYoudao(seg, sourceLang, targetLang);
        } else if (backend === 'baidu' || backend === 'microsoft') {
          // Optional backends with API keys
          const apiKeys = settings.apiKeys || {};
          if (apiKeys[backend]) {
            // Placeholder for future backend implementations
            continue;
          }
          continue;
        }
        if (translated) break;
      } catch (e) {
        console.warn(`Backend ${backend} failed:`, e.message);
      }
    }
    if (!translated) throw new Error('所有翻译后端不可用，请检查网络或尝试切换后端');
    translatedParts.push(translated);
  }

  let finalTranslation = translatedParts.join('');

  // Step 6: Apply glossary corrections post-translation
  if (Object.keys(placeholderMap).length > 0) {
    finalTranslation = applyGlossary(finalTranslation, placeholderMap);
  }

  // Step 7: Cache result
  if (cacheEnabled) {
    const key = cacheKey(text, sourceLang, targetLang);
    await setCache(key, { translated: finalTranslation, sourceLang, targetLang });
  }

  return { translated: finalTranslation, sourceLang, targetLang, fromCache: false };
}

// Word bag translation: dual-path (combined + individual) + phrase detection
async function translateWordBag(wordBag, options = {}) {
  const words = wordBag.map(w => w.text);

  // Path 1: Combined translation
  let combinedText = '';
  const sourceLang = detectLang(words[0]);
  // Join based on language
  if (sourceLang === 'zh-CN') {
    combinedText = words.join('');
  } else {
    combinedText = words.join(' ');
  }

  // Path 1 & 2 in parallel
  const [combinedResult, ...individualResults] = await Promise.all([
    translate(combinedText, options).catch(() => ({ translated: '' })),
    ...words.map(w => translate(w, options).catch(() => ({ translated: '' })))
  ]);

  // Phrase detection: compare combined vs concatenated individual translations
  const individualJoined = individualResults.map(r => r.translated).join('');
  const similarity = stringSimilarity(combinedResult.translated, individualJoined);

  // Low similarity → combined result is likely a phrase
  const isPhrase = similarity < 0.6;

  return {
    isPhrase,
    combined: isPhrase ? combinedResult.translated : null,
    words: wordBag.map((w, i) => ({
      original: w.text,
      translated: individualResults[i].translated
    })),
    sourceLang,
    targetLang: getTargetLang(sourceLang)
  };
}

// Simple Levenshtein-based similarity
function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const lenA = a.length, lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;
  const maxLen = Math.max(lenA, lenB);
  if (maxLen === 0) return 1;

  // Levenshtein distance with space-optimized rows
  let prev = Array(lenB + 1);
  let curr = Array(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return 1 - prev[lenB] / maxLen;
}
