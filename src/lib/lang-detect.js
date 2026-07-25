// Detect Chinese vs English by CJK character ratio
function detectLang(text) {
  let cjk = 0, total = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if ((code >= 0x4E00 && code <= 0x9FFF) ||
        (code >= 0x3400 && code <= 0x4DBF) ||
        (code >= 0xF900 && code <= 0xFAFF) ||
        (code >= 0x3000 && code <= 0x303F) ||
        (code >= 0xFF00 && code <= 0xFFEF)) {
      cjk++;
    }
    if (ch.trim()) total++;
  }
  const ratio = total > 0 ? cjk / total : 0;
  return ratio > 0.3 ? 'zh-CN' : 'en';
}

function getTargetLang(sourceLang, fastDirection) {
  if (fastDirection === 'zh2en') return 'en';
  if (fastDirection === 'en2zh') return 'zh-CN';
  return sourceLang === 'zh-CN' ? 'en' : 'zh-CN';
}
