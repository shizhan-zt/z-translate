// Glossary: protect known terms before translation, apply corrections after
const PLACEHOLDER_PREFIX = '__GT_';
const PLACEHOLDER_SUFFIX = '__';

function protectTerms(text, glossary) {
  const map = {};
  let result = text;
  let idx = 0;

  // Sort by length descending so longer terms match first
  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);

  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    result = result.replace(regex, match => {
      const placeholder = `${PLACEHOLDER_PREFIX}${idx}${PLACEHOLDER_SUFFIX}`;
      map[placeholder] = glossary[term] || glossary[term.toLowerCase()] || match;
      idx++;
      return placeholder;
    });
  }

  return { protectedText: result, placeholderMap: map };
}

function applyGlossary(text, placeholderMap) {
  let result = text;
  for (const [placeholder, replacement] of Object.entries(placeholderMap)) {
    result = result.replace(new RegExp(placeholder, 'gi'), replacement);
  }
  return result;
}

// Detect proper nouns: consecutive capitalized words in English
function detectProperNouns(text) {
  const matches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  return matches || [];
}

// Detect Chinese proper nouns: content inside 《》 「」 ""
function detectChineseProperNouns(text) {
  const matches = text.match(/[《「"]([^》」"]+)[》」"]/g);
  return matches ? matches.map(m => m.replace(/[《「"》」"]/g, '')) : [];
}
