const QRCode = require('qrcode');
module.exports = async function generate({ args }) {
  const text = (args && args.join(' ')) || '';
  if (!text) return 'Usage: generate <text> [style]';
  let style = 'matrix';
  if (args.length > 1) {
    const last = args[args.length - 1];
    if (['matrix', 'neon', 'cyan', 'red', 'white', 'hacker'].includes(last)) {
      style = last;
    }
  }
  const styles = {
    matrix: { fg: '#00FF00', bg: '#0A0A0A' },
    neon: { fg: '#FF00FF', bg: '#000000' },
    cyan: { fg: '#00FFFF', bg: '#0A0A0A' },
    red: { fg: '#FF4444', bg: '#0A0A0A' },
    white: { fg: '#FFFFFF', bg: '#000000' },
    hacker: { fg: '#00FF00', bg: '#000000' }
  };
  const c = styles[style] || styles.matrix;
  const dataUrl = await QRCode.toDataURL(text, {
    type: 'png', errorCorrectionLevel: 'H', margin: 2, width: 300,
    color: { dark: c.fg, light: c.bg }
  });
  return { dataUrl, text, style };
};