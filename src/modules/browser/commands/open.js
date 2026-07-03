const { spawn, execSync } = require('child_process');
const browsers = {
  firefox: ['firefox', 'firefox-esr'],
  chromium: ['chromium-browser', 'chromium'],
  chrome: ['google-chrome', 'google-chrome-stable'],
  brave: ['brave-browser', 'brave']
};
function findBrowser(browserName) {
  const cmds = browsers[browserName] || browsers.firefox;
  for (const cmd of cmds) {
    try { const r = execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' }); if (r.trim()) return r.trim(); } catch (e) { }
  }
  return 'xdg-open';
}
module.exports = function open({ args }) {
  const url = (args && args[0]) || '';
  if (!url) return 'Usage: open <url> [browser]';
  const browserName = (args && args[1]) || 'firefox';
  const browserCmd = findBrowser(browserName);
  const proc = spawn(browserCmd, [url], { detached: true, stdio: 'ignore' });
  proc.unref();
  return `Opened ${url} with ${browserCmd}`;
};