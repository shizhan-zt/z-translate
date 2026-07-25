// TTS using browser's built-in SpeechSynthesis API
function speak(text, lang) {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voiceLang = lang === 'zh-CN' ? 'zh-CN' : 'en-US';

  const voices = window.speechSynthesis.getVoices();
  const zhPrefs = ['Xiaoxiao', 'Yunyang', 'Xiaoyi', 'Yunxi', 'Xiaohan'];
  const enPrefs = ['Aria', 'Guy', 'Ana', 'Jenny', 'Michelle', 'Christopher', 'Eric', 'Roger', 'Steffan'];
  let match = null;
  if (voiceLang === 'zh-CN') {
    for (const pref of zhPrefs) {
      match = voices.find(v => v.name.includes(pref) && v.lang.startsWith('zh-CN'));
      if (match) break;
    }
    if (!match) match = voices.find(v => v.lang.startsWith('zh-CN'));
    if (!match) match = voices.find(v => v.lang.startsWith('zh'));
  } else {
    for (const pref of enPrefs) {
      match = voices.find(v => v.name.includes(pref) && v.lang.startsWith('en-US'));
      if (match) break;
    }
    if (!match) match = voices.find(v => v.lang.startsWith('en-US'));
    if (!match) match = voices.find(v => v.lang.startsWith('en'));
  }
  if (!match) match = voices[0];

  if (match) utterance.voice = match;
  utterance.lang = voiceLang;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
