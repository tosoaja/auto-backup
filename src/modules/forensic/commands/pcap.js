const fs = require('fs');
const { run } = require('../utils/runner');

module.exports = async function pcap({ filePath }) {
  const stat = fs.statSync(filePath);
  const { output } = await run(
    `tcpdump -r "${filePath}" -nn 2>/dev/null | head -100 || tshark -r "${filePath}" -T fields -e frame.number -e ip.src -e ip.dst -e frame.protocols 2>/dev/null | head -100 || echo "pcap/tcpdump not available"`
  );
  return `PCAP file: ${(stat.size / 1024).toFixed(2)} KB\nPackets:\n${output}`;
};
