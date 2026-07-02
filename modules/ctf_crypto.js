const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function _hex(buf) { return buf.toString('hex'); }
function _fromHex(s) { return Buffer.from(s, 'hex'); }

async function execute(socket, data) {
  const { command } = data;
  if (!command) return socket.emit('ctf-output', { type: 'error', output: '[!] No command specified', category: 'crypto' });

  try {
    let output = '';
    const parts = command.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'base64': {
        const flag = args[0];
        const text = (flag === '-e' || flag === '-d' ? args.slice(1) : args).join(' ');
        if (!text) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: base64 [-e/-d] <data>', category: 'crypto', command });
        if (flag === '-d') output = Buffer.from(text, 'base64').toString('utf8');
        else output = Buffer.from(text).toString('base64');
        break;
      }
      case 'hex': {
        const flag = args[0];
        const text = (flag === '-e' || flag === '-d' ? args.slice(1) : args).join(' ');
        if (!text) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: hex [-e/-d] <data>', category: 'crypto', command });
        if (flag === '-d') output = _fromHex(text.replace(/\s/g, '')).toString('utf8');
        else output = Buffer.from(text).toString('hex');
        break;
      }
      case 'rot13': {
        const text = args.join(' ');
        if (!text) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: rot13 <text>', category: 'crypto', command });
        output = text.replace(/[a-zA-Z]/g, c =>
          String.fromCharCode(c <= 'Z' ? (c.charCodeAt(0) - 65 + 13) % 26 + 65 : (c.charCodeAt(0) - 97 + 13) % 26 + 97)
        );
        break;
      }
      case 'caesar': {
        const text = args.slice(0, -1).join(' ');
        const shift = parseInt(args[args.length - 1]);
        if (!text || isNaN(shift)) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: caesar <text> <shift>', category: 'crypto', command });
        const s = ((shift % 26) + 26) % 26;
        output = text.replace(/[a-zA-Z]/g, c => {
          const base = c <= 'Z' ? 65 : 97;
          return String.fromCharCode((c.charCodeAt(0) - base + s) % 26 + base);
        });
        break;
      }
      case 'xor': {
        const text = args.slice(0, -1).join(' ');
        const key = args[args.length - 1];
        if (!text || !key) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: xor <data> <key>', category: 'crypto', command });
        const buf = Buffer.from(text, 'latin1');
        const keyBuf = Buffer.from(key, 'latin1');
        const result = Buffer.alloc(buf.length);
        for (let i = 0; i < buf.length; i++) result[i] = buf[i] ^ keyBuf[i % keyBuf.length];
        output = result.toString('latin1');
        output += `\nHex: ${result.toString('hex')}`;
        break;
      }
      case 'aes': {
        const flag = args[0];
        const text = args.slice(1, -1).join(' ');
        const key = args[args.length - 1];
        if (!['-e', '-d'].includes(flag) || !text || !key) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: aes [-e/-d] <data> <key>', category: 'crypto', command });
        const keyBuf = crypto.createHash('sha256').update(key).digest().slice(0, 32);
        const iv = crypto.randomBytes(16);
        if (flag === '-e') {
          const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
          const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
          output = iv.toString('hex') + ':' + enc.toString('hex');
          output += '\n[IV:Encrypted format - use same IV + key to decrypt]';
        } else {
          const parts = text.split(':');
          if (parts.length !== 2) return socket.emit('ctf-output', { type: 'error', output: '[!] Invalid format. Expected iv:ciphertext in hex', category: 'crypto', command });
          const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, _fromHex(parts[0]));
          const dec = Buffer.concat([decipher.update(_fromHex(parts[1])), decipher.final()]);
          output = dec.toString('utf8');
        }
        break;
      }
      case 'hash': {
        const text = args.join(' ');
        if (!text) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: hash <data>', category: 'crypto', command });
        const algs = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];
        output = algs.map(a => `${a.toUpperCase()}: ${crypto.createHash(a).update(text).digest('hex')}`).join('\n');
        break;
      }
      case 'hashid': {
        const hash = args[0];
        if (!hash) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: hashid <hash>', category: 'crypto', command });
        const hashModule = require('./hashid');
        const result = hashModule.identify(hash);
        if (result.success && result.possibleTypes.length) {
          output = `Hash: ${hash}\nLength: ${result.length}\nCharset: ${result.charset}\nPossible types:\n`;
          output += result.possibleTypes.map(t => `  - ${t.name}${t.bits ? ` (${t.bits} bits)` : ''}`).join('\n');
        } else {
          output = 'Unknown hash type';
        }
        break;
      }
      case 'crack': {
        const hash = args[0];
        const wordlist = args[1];
        if (!hash) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: crack <hash> <wordlist>', category: 'crypto', command });
        const hashModule = require('./hashid');
        const result = await hashModule.crackWithWordlist(hash, wordlist);
        if (result.cracked) output = `Password found: ${result.password}`;
        else output = `Not cracked. Reason: ${result.reason || 'Not in wordlist'}`;
        break;
      }
      case 'freq': {
        const text = args.join(' ');
        if (!text) return socket.emit('ctf-output', { type: 'error', output: '[!] Usage: freq <text>', category: 'crypto', command });
        const freq = {};
        let total = 0;
        for (const c of text.toLowerCase()) {
          if (/[a-z]/.test(c)) { freq[c] = (freq[c] || 0) + 1; total++; }
        }
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        output = `Total letters: ${total}\nFrequency:\n`;
        output += sorted.map(([c, n]) => `  ${c}: ${n} (${(n / total * 100).toFixed(2)}%)`).join('\n');
        output += '\n\nExpected English frequency: e t a o i n s h r d l c u m w f g y p b v k j x q z';
        break;
      }
      default:
        output = `[!] Unknown crypto command: ${cmd}`;
    }

    socket.emit('ctf-output', { type: 'result', output, category: 'crypto', command });
  } catch (err) {
    socket.emit('ctf-output', { type: 'error', output: `[!] ${err.message}`, category: 'crypto', command });
  }
}

module.exports = { execute };
