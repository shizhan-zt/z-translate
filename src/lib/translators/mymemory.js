// MyMemory free translation API — no API key required
// Endpoint: https://api.mymemory.translated.net/get
// Anonymous limit: ~500 chars/request, 1000 requests/day

const MYMEMORY_CHUNK_SIZE = 450;

async function translateMyMemory(text, sourceLang, targetLang) {
  const sl = sourceLang === 'zh-CN' ? 'zh-CN' : 'en-GB';
  const tl = targetLang === 'zh-CN' ? 'zh-CN' : 'en-GB';
  const langpair = `${sl}|${tl}`;

  // Split long text into chunks at sentence boundaries
  const chunks = splitForMyMemory(text);
  const results = [];

  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(langpair)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);

      const data = await res.json();
      if (data.responseStatus !== 200) throw new Error(`MyMemory status ${data.responseStatus}`);
      if (!data.responseData || !data.responseData.translatedText) throw new Error('Empty translation');

      results.push(data.responseData.translatedText);
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  return results.join('');
}

// Split text at sentence boundaries, keeping each chunk under MYMEMORY_CHUNK_SIZE
function splitForMyMemory(text) {
  if (text.length <= MYMEMORY_CHUNK_SIZE) return [text];

  // Match sentence-ending punctuation followed by space or end
  const sentenceRe = /([。！？.!?\n]+)/g;
  const parts = text.split(sentenceRe);

  const chunks = [];
  let current = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (current.length + part.length <= MYMEMORY_CHUNK_SIZE) {
      current += part;
    } else {
      if (current) chunks.push(current);
      // If a single part is still too long, split at word boundaries
      if (part.length > MYMEMORY_CHUNK_SIZE) {
        let remaining = part;
        while (remaining.length > MYMEMORY_CHUNK_SIZE) {
          // Find a space to split
          let splitAt = remaining.lastIndexOf(' ', MYMEMORY_CHUNK_SIZE);
          if (splitAt <= 0) splitAt = MYMEMORY_CHUNK_SIZE;
          chunks.push(remaining.substring(0, splitAt));
          remaining = remaining.substring(splitAt);
        }
        current = remaining;
      } else {
        current = part;
      }
    }
  }
  if (current) chunks.push(current);

  return chunks.length ? chunks : [text.substring(0, MYMEMORY_CHUNK_SIZE)];
}
