module.exports = function xor({ args }) {
  if (!args || args.length < 2) return 'Usage: xor <data> <key>';
  const data = args.slice(0, -1).join(' ');
  const key = args[args.length - 1];

  let dataBuf;
  if (/^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0) {
    dataBuf = Buffer.from(data, 'hex');
  } else {
    dataBuf = Buffer.from(data);
  }

  const keyBuf = Buffer.from(key);
  const result = Buffer.alloc(dataBuf.length);
  for (let i = 0; i < dataBuf.length; i++) {
    result[i] = dataBuf[i] ^ keyBuf[i % keyBuf.length];
  }

  const asHex = result.toString('hex');
  const asText = result.toString('utf-8');
  return `Hex: ${asHex}\nText: ${asText}`;
};
