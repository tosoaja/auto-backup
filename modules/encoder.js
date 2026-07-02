class EncoderDecoder {
  encode(type, text) {
    if (!text) return { success: false, error: 'No text provided' };
    try {
      let result;
      switch (type) {
        case 'base64':
          result = Buffer.from(text).toString('base64');
          break;
        case 'base64url':
          result = Buffer.from(text).toString('base64url');
          break;
        case 'hex':
          result = Buffer.from(text).toString('hex');
          break;
        case 'url':
          result = encodeURIComponent(text);
          break;
        case 'html':
          result = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          break;
        case 'rot13':
          result = text.replace(/[a-zA-Z]/g, c => String.fromCharCode(c <= 'Z' ? ((c.charCodeAt(0) - 65 + 13) % 26 + 65) : ((c.charCodeAt(0) - 97 + 13) % 26 + 97)));
          break;
        case 'binary':
          result = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
          break;
        default:
          return { success: false, error: `Unknown encoding: ${type}` };
      }
      return { success: true, type, direction: 'encode', input: text, output: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  decode(type, text) {
    if (!text) return { success: false, error: 'No text provided' };
    try {
      let result;
      switch (type) {
        case 'base64':
          result = Buffer.from(text, 'base64').toString('utf8');
          break;
        case 'base64url':
          result = Buffer.from(text, 'base64url').toString('utf8');
          break;
        case 'hex':
          result = Buffer.from(text, 'hex').toString('utf8');
          break;
        case 'url':
          result = decodeURIComponent(text);
          break;
        case 'html':
          result = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/');
          break;
        case 'rot13':
          result = text.replace(/[a-zA-Z]/g, c => String.fromCharCode(c <= 'Z' ? ((c.charCodeAt(0) - 65 + 13) % 26 + 65) : ((c.charCodeAt(0) - 97 + 13) % 26 + 97)));
          break;
        case 'binary':
          result = text.split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join('');
          break;
        default:
          return { success: false, error: `Unknown encoding: ${type}` };
      }
      return { success: true, type, direction: 'decode', input: text, output: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new EncoderDecoder();
