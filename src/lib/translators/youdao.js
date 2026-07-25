// Youdao internal web translate API
// Flow: get key -> POST translate -> AES-128-CBC decrypt response

const KEY_URL = 'https://dict.youdao.com/webtranslate/key';
const TRANS_URL = 'https://dict.youdao.com/webtranslate';

async function getYoudaoKey() {
  const ts = Date.now();
  const sign = md5(`client=fanyideskweb&mysticTime=${ts}&product=webfanyi&key=asdjnjfenknafdfsdfsd`);
  const url = `${KEY_URL}?client=fanyideskweb&mysticTime=${ts}&product=webfanyi&key=asdjnjfenknafdfsdfsd&sign=${sign}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Youdao key HTTP ${res.status}`);
  const data = await res.json();
  if (!data || !data.data) throw new Error('Invalid key response');
  return data.data; // { aesKey, aesIv, secretKey }
}

async function translateYoudao(text, sourceLang, targetLang) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const { aesKey, aesIv, secretKey } = await getYoudaoKey();

    const from = sourceLang === 'zh-CN' ? 'zh-CHS' : 'en';
    const to = targetLang === 'zh-CN' ? 'zh-CHS' : 'en';

    const ts = Date.now();
    const sign = md5(`client=fanyideskweb&mysticTime=${ts}&product=webfanyi&key=${secretKey}`);

    const body = new URLSearchParams({
      i: text,
      from, to,
      domain: '0',
      dictResult: 'true',
      keyid: 'webfanyi',
      sign,
      client: 'fanyideskweb',
      product: 'webfanyi',
      appVersion: '1.0.0',
      vendor: 'web',
      mysticTime: String(ts),
      pointParam: '1'
    });

    const res = await fetch(TRANS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`Youdao HTTP ${res.status}`);

    const encrypted = await res.arrayBuffer();
    const decrypted = await aesDecrypt(encrypted, aesKey, aesIv);
    const result = JSON.parse(decrypted);

    // Extract translation from response structure
    if (result.translateResult && result.translateResult[0] && result.translateResult[0][0]) {
      return result.translateResult[0][0].tgt;
    }
    throw new Error('Unexpected response structure');
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function aesDecrypt(encryptedBuf, keyHex, ivHex) {
  // Handle hex strings
  let keyBytes, ivBytes;

  if (typeof keyHex === 'string' && keyHex.length === 32) {
    keyBytes = hexToBytes(keyHex);
  } else {
    // Key might already be bytes or need MD5 hashing
    const keyDigest = md5(keyHex || '');
    keyBytes = hexToBytes(keyDigest);
  }

  if (typeof ivHex === 'string' && ivHex.length === 32) {
    ivBytes = hexToBytes(ivHex);
  } else {
    const ivDigest = md5(ivHex || '');
    ivBytes = hexToBytes(ivDigest);
  }

  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: ivBytes },
    key,
    encryptedBuf
  );

  return new TextDecoder().decode(decrypted);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
