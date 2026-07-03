const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '..', '..', '..', 'temp_ctf');

module.exports = {
  async onLoad({ config, logger, pluginPath }) {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    logger.info('[forensic] Module loaded', { tempDir: TEMP_DIR });
  },

  async onUnload() {
    // Cleanup temp files if needed
  },

  TEMP_DIR
};
