// Split text at sentence boundaries to preserve complete semantics
function segmentText(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const sentenceBreaks = /([。！？.!?\n]+)/g;
  const segments = [];
  let current = '';

  const parts = text.split(sentenceBreaks);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (current.length + part.length <= maxLen) {
      current += part;
    } else {
      if (current) segments.push(current);
      current = part.length > maxLen ? part.substring(0, maxLen) : part;
    }
  }
  if (current) segments.push(current);

  return segments.length ? segments : [text.substring(0, maxLen)];
}

// Build cache key from text + lang pair
function cacheKey(text, sourceLang, targetLang) {
  return `${sourceLang}:${targetLang}:${text}`;
}
