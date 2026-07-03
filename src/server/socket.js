const fs = require('fs');
const path = require('path');
const terminalHandler = require('../../routes/terminal');

function createSocketHandlers(io, config, { logger, eventBus, registry }) {
  const activeNmapProcesses = new Map();

  io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;
    logger.info('Client connected', { socketId: socket.id, ip: clientIp });
    eventBus.emit('client.connected', { socketId: socket.id, ip: clientIp });

    socket.emit('server-message', {
      type: 'info',
      message: `Connected to ${config.app.name} v${config.app.version}`,
      timestamp: new Date().toISOString()
    });

    socket.emit('client-info', { ip: clientIp, socketId: socket.id });

    // New plugin-based command dispatch
    socket.on('command', async (data) => {
      const { command, args, file, fileName } = data;
      if (!command) {
        socket.emit('command:result', { success: false, error: 'No command specified' });
        return;
      }

      let filePath = null;
      if (file) {
        const ext = fileName ? path.extname(fileName) || '.bin' : '.bin';
        const tempDir = path.resolve(process.cwd(), 'temp_ctf');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        filePath = path.join(tempDir, `file_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
        fs.writeFileSync(filePath, Buffer.from(file, 'base64'));
      }

      try {
        const context = {
          args: args || [],
          filePath,
          fileName,
          socket,
          user: { role: 'admin' },
          logger
        };

        const result = await registry.execute(command, context);
        socket.emit('command:result', result);
        logger.command(socket.id, command, args, result);
      } catch (err) {
        socket.emit('command:result', { success: false, command, error: err.message });
        logger.error(`Command failed: ${command}`, { error: err.message, socketId: socket.id });
      } finally {
        if (filePath && filePath.includes('temp_ctf')) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
    });

    // List available commands
    socket.on('command:list', () => {
      socket.emit('command:list', registry.listByCategory());
    });

    socket.on('execute-command', (data) => {
      terminalHandler.execute(socket, data);
      eventBus.emit('command.executed', { socketId: socket.id, command: data.command });
    });
    socket.on('cancel-command', () => terminalHandler.cancel(socket.id));

    socket.on('get-system-info', async () => {
      try {
        const sysModule = require('../../modules/system');
        const info = await sysModule.getSystemInfo();
        socket.emit('system-info', info);
      } catch (err) {
        socket.emit('system-info', { error: err.message });
        logger.error('System info failed', { error: err.message, socketId: socket.id });
      }
    });

    socket.on('get-network-info', async (data) => {
      try {
        const networkModule = require('../../modules/network');
        const info = await networkModule.execute(data.command, data.target);
        socket.emit('network-info', info);
      } catch (err) {
        socket.emit('network-info', { error: err.message });
      }
    });

    socket.on('get-wifi-info', async () => {
      try {
        const wifiModule = require('../../modules/wifi');
        const info = await wifiModule.getWifiProfiles();
        socket.emit('wifi-info', info);
      } catch (err) {
        socket.emit('wifi-info', { error: err.message });
      }
    });

    socket.on('open-browser', (data) => {
      const browserModule = require('../../modules/browser');
      browserModule.openUrl(data.url, data.browser || 'firefox');
      socket.emit('browser-opened', { success: true, url: data.url, browser: data.browser });
    });

    socket.on('nmap-check', async () => {
      const nmapModule = require('../../modules/nmap');
      const result = await nmapModule.checkInstalled();
      if (result.installed) result.version = await nmapModule.getVersion();
      socket.emit('nmap-status', result);
    });

    socket.on('nmap-scan', (data) => {
      const nmapModule = require('../../modules/nmap');
      const { target, ports } = data;
      if (!target) {
        socket.emit('nmap-output', { type: 'error', output: '[!] Target cannot be empty!' });
        return;
      }

      const prevProcess = activeNmapProcesses.get(socket.id);
      if (prevProcess) { prevProcess.kill('SIGTERM'); activeNmapProcesses.delete(socket.id); }

      socket.emit('nmap-output', { type: 'info', output: `Starting Nmap scan on: ${target}` });
      socket.emit('nmap-output', { type: 'info', output: `Ports: ${ports || '1-1000'}` });
      socket.emit('nmap-output', { type: 'separator', output: '\u2500'.repeat(60) });
      socket.emit('nmap-scan-status', { status: 'scanning', target });

      const proc = nmapModule.scanPorts(
        target, ports || '1-1000',
        (data) => socket.emit('nmap-output', data),
        (result) => {
          activeNmapProcesses.delete(socket.id);
          socket.emit('nmap-output', { type: 'separator', output: '\u2500'.repeat(60) });
          socket.emit('nmap-output', { type: result.exitCode === 0 ? 'success' : 'error', output: `[Scan complete] Exit code: ${result.exitCode}` });
          socket.emit('nmap-complete', result);
          socket.emit('nmap-scan-status', { status: 'complete' });
        },
        (error) => {
          activeNmapProcesses.delete(socket.id);
          socket.emit('nmap-output', { type: 'error', output: `[!] ${error.message}` });
          socket.emit('nmap-complete', { error: error.message });
          socket.emit('nmap-scan-status', { status: 'error' });
        }
      );
      if (proc) activeNmapProcesses.set(socket.id, proc);
    });

    socket.on('nmap-cancel', () => {
      const proc = activeNmapProcesses.get(socket.id);
      if (proc) {
        proc.kill('SIGTERM');
        activeNmapProcesses.delete(socket.id);
        socket.emit('nmap-output', { type: 'warning', output: '[!] Scan cancelled.' });
        socket.emit('nmap-complete', { cancelled: true });
        socket.emit('nmap-scan-status', { status: 'cancelled' });
      }
    });

    socket.on('qr-generate', async (data) => {
      const qrGenerator = require('../../modules/qrcode_gen');
      const { text, style, saveAs } = data;
      if (!text || !text.trim()) {
        socket.emit('qr-result', { success: false, error: 'Text/URL cannot be empty!' });
        return;
      }
      let result;
      if (saveAs) result = await qrGenerator.generateAndSave(text, saveAs, {});
      else if (style) result = await qrGenerator.generateStyledQR(text, style);
      else result = await qrGenerator.generateQR(text);
      socket.emit('qr-result', result);
    });

    socket.on('qr-batch', async (data) => {
      const qrGenerator = require('../../modules/qrcode_gen');
      const result = await qrGenerator.batchGenerate(data.items);
      socket.emit('qr-batch-result', result);
    });

    socket.on('clickjack-test', async (data) => {
      const clickjackTester = require('../../modules/clickjack');
      const { url } = data;
      if (!url || !url.trim()) {
        socket.emit('clickjack-result', { success: false, error: 'URL cannot be empty!' });
        return;
      }
      socket.emit('clickjack-output', { type: 'info', output: `Testing: ${url}` });
      const result = await clickjackTester.test(url);
      socket.emit('clickjack-result', result);
      socket.emit('clickjack-output', { type: 'info', output: `Verdict: ${result.verdict}` });
      socket.emit('clickjack-output', { type: 'info', output: result.summary });
      const testHTML = clickjackTester.generateTestHTML(url);
      socket.emit('clickjack-test-html', { html: testHTML, url });
    });

    socket.on('subdomain-find', async (data) => {
      const subdomainModule = require('../../modules/subdomain');
      const { domain, method } = data;
      if (method === 'crt.sh' || method === 'all') {
        const result = await subdomainModule.findWithCrtSh(domain);
        socket.emit('subdomain-result', { ...result, method: 'crt.sh' });
      }
      if (method === 'dns' || method === 'all') {
        socket.emit('subdomain-output', { type: 'info', output: 'DNS bruteforce started...' });
        const result = await subdomainModule.findWithDnsBruteforce(domain);
        socket.emit('subdomain-result', { ...result, method: 'dns' });
      }
    });

    socket.on('hash-identify', async (data) => {
      const hashModule = require('../../modules/hashid');
      const result = hashModule.identify(data.hash);
      socket.emit('hash-result', result);
    });

    socket.on('hash-crack', async (data) => {
      const hashModule = require('../../modules/hashid');
      const result = await hashModule.crackWithWordlist(data.hash, data.wordlist);
      socket.emit('hash-result', result);
    });

    socket.on('password-generate', (data) => {
      const pwModule = require('../../modules/pwgen');
      const result = pwModule.generate(data.options || {});
      socket.emit('password-result', result);
    });

    socket.on('bandwidth-start', () => {
      const bwModule = require('../../modules/bandwidth');
      bwModule.startStream((data) => {
        socket.emit('bandwidth-data', data);
      });
    });

    socket.on('bandwidth-stop', () => {
      const bwModule = require('../../modules/bandwidth');
      bwModule.stopStream();
    });

    socket.on('dns-lookup', async (data) => {
      const dnsModule = require('../../modules/dnslookup');
      const result = await dnsModule.lookup(data.domain, data.types);
      socket.emit('dns-result', result);
    });

    socket.on('encoder-encode', (data) => {
      const encoderModule = require('../../modules/encoder');
      const result = encoderModule.encode(data.type, data.text);
      socket.emit('encoder-result', result);
    });

    socket.on('encoder-decode', (data) => {
      const encoderModule = require('../../modules/encoder');
      const result = encoderModule.decode(data.type, data.text);
      socket.emit('encoder-result', result);
    });

    socket.on('reverseip-lookup', async (data) => {
      const ripModule = require('../../modules/reverseip');
      const result = await ripModule.lookup(data.target);
      socket.emit('reverseip-result', result);
    });

    socket.on('reverseip-api', async (data) => {
      const ripModule = require('../../modules/reverseip');
      const result = await ripModule.lookupViaApi(data.ip);
      socket.emit('reverseip-result', result);
    });

    socket.on('ctf-execute', (data) => {
      const { category } = data;
      try {
        const moduleMap = {
          'forensic': '../../modules/forensic',
          'crypto': '../../modules/ctf_crypto',
          'pwn': '../../modules/pwn',
          'reverse': '../../modules/reverse'
        };
        const modPath = moduleMap[category];
        if (!modPath) throw new Error(`Unknown CTF category: ${category}`);
        const mod = require(modPath);
        mod.execute(socket, data);
      } catch (err) {
        socket.emit('ctf-output', { type: 'error', output: `[!] ${err.message}` });
      }
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
      eventBus.emit('client.disconnected', { socketId: socket.id });
      terminalHandler.cancel(socket.id);
      const nmapProc = activeNmapProcesses.get(socket.id);
      if (nmapProc) { nmapProc.kill('SIGTERM'); activeNmapProcesses.delete(socket.id); }
      try {
        const bwModule = require('../../modules/bandwidth');
        bwModule.stopStream();
      } catch (e) { /* ignore */ }
    });
  });

  return { activeNmapProcesses };
}

module.exports = { createSocketHandlers };
