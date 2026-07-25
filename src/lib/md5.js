// Pure JS MD5 implementation for Youdao sign generation
function md5(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) { bytes.push(0xc0 | (code >> 6)); bytes.push(0x80 | (code & 0x3f)); }
    else { bytes.push(0xe0 | (code >> 12)); bytes.push(0x80 | ((code >> 6) & 0x3f)); bytes.push(0x80 | (code & 0x3f)); }
  }

  let ml = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length + 8) % 64 !== 0) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push((ml >>> (i * 8)) & 0xff);

  const S = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  const K = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  for (let i = 0; i < bytes.length; i += 64) {
    const M = [];
    for (let j = 0; j < 16; j++) {
      M[j] = bytes[i + j * 4] | (bytes[i + j * 4 + 1] << 8) |
             (bytes[i + j * 4 + 2] << 16) | (bytes[i + j * 4 + 3] << 24);
    }
    let A = a, B = b, C = c, D = d;
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) { f = (B & C) | (~B & D); g = j; }
      else if (j < 32) { f = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { f = C ^ (B | ~D); g = (7 * j) % 16; }
      f = (f + A + K[j] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + ((f << S[(j >> 4) * 4 + (j & 3)]) | (f >>> (32 - S[(j >> 4) * 4 + (j & 3)])))) | 0;
    }
    a = (a + A) | 0; b = (b + B) | 0; c = (c + C) | 0; d = (d + D) | 0;
  }
  return [a,b,c,d].map(x => {
    let h = '';
    for (let i = 0; i < 4; i++) h += ((x >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return h;
  }).join('');
}
