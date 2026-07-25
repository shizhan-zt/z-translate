// Google Translate unofficial API
async function translateGoogle(text, sourceLang, targetLang) {
  const sl = sourceLang === 'zh-CN' ? 'zh-CN' : 'en';
  const tl = targetLang === 'zh-CN' ? 'zh-CN' : 'en';

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data[0]) throw new Error('Empty response');
    const translated = data[0].map(seg => seg[0] || '').join('');
    return translated;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
