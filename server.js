#!/usr/bin/env node

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes/api');
const terminalHandler = require('./routes/terminal');

const nmapModule = require('./modules/nmap');
const qrGenerator = require('./modules/qrcode_gen');
const clickjackTester = require('./modules/clickjack');
const forensicModule = require('./modules/forensic');
const ctfCryptoModule = require('./modules/ctf_crypto');
const pwnModule = require('./modules/pwn');
const reverseModule = require('./modules/reverse');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    cors: { origin: "*" }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    message: { error: 'Too many requests, chill cuy!' }
});
app.use('/api', limiter);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);

const activeNmapProcesses = new Map();

io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;
    console.log(`[+] Client connected: ${socket.id} from ${clientIp}`);

    socket.emit('server-message', {
        type: 'info',
        message: 'Connected to toolkit v3.1',
        timestamp: new Date().toISOString()
    });

    socket.emit('client-info', { ip: clientIp, socketId: socket.id });

    socket.on('execute-command', (data) => { terminalHandler.execute(socket, data); });
    socket.on('cancel-command', () => { terminalHandler.cancel(socket.id); });

    socket.on('get-system-info', async () => {
        try {
            const sysModule = require('./modules/system');
            const info = await sysModule.getSystemInfo();
            socket.emit('system-info', info);
        } catch (err) {
            socket.emit('system-info', { error: err.message });
        }
    });

    socket.on('get-network-info', async (data) => {
        try {
            const networkModule = require('./modules/network');
            const info = await networkModule.execute(data.command, data.target);
            socket.emit('network-info', info);
        } catch (err) {
            socket.emit('network-info', { error: err.message });
        }
    });

    socket.on('get-wifi-info', async () => {
        try {
            const wifiModule = require('./modules/wifi');
            const info = await wifiModule.getWifiProfiles();
            socket.emit('wifi-info', info);
        } catch (err) {
            socket.emit('wifi-info', { error: err.message });
        }
    });

    socket.on('open-browser', (data) => {
        const browserModule = require('./modules/browser');
        browserModule.openUrl(data.url, data.browser || 'firefox');
        socket.emit('browser-opened', { success: true, url: data.url, browser: data.browser });
    });

    socket.on('nmap-check', async () => {
        const result = await nmapModule.checkInstalled();
        if (result.installed) result.version = await nmapModule.getVersion();
        socket.emit('nmap-status', result);
    });

    socket.on('nmap-scan', (data) => {
        const { target, ports } = data;
        if (!target) {
            socket.emit('nmap-output', { type: 'error', output: '[!] Target cannot be empty!' });
            return;
        }

        const prevProcess = activeNmapProcesses.get(socket.id);
        if (prevProcess) { prevProcess.kill('SIGTERM'); activeNmapProcesses.delete(socket.id); }

        socket.emit('nmap-output', { type: 'info', output: `⚡ Starting Nmap scan on: ${target}` });
        socket.emit('nmap-output', { type: 'info', output: `🔌 Ports: ${ports || '1-1000'}` });
        socket.emit('nmap-output', { type: 'separator', output: '─'.repeat(60) });
        socket.emit('nmap-scan-status', { status: 'scanning', target });

        const proc = nmapModule.scanPorts(
            target, ports || '1-1000',
            (data) => socket.emit('nmap-output', data),
            (result) => {
                activeNmapProcesses.delete(socket.id);
                socket.emit('nmap-output', { type: 'separator', output: '─'.repeat(60) });
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
        const result = await qrGenerator.batchGenerate(data.items);
        socket.emit('qr-batch-result', result);
    });

    socket.on('clickjack-test', async (data) => {
        const { url } = data;
        if (!url || !url.trim()) {
            socket.emit('clickjack-result', { success: false, error: 'URL cannot be empty!' });
            return;
        }
        socket.emit('clickjack-output', { type: 'info', output: `🎯 Testing: ${url}` });
        const result = await clickjackTester.test(url);
        socket.emit('clickjack-result', result);
        socket.emit('clickjack-output', { type: 'info', output: `📊 Verdict: ${result.verdict}` });
        socket.emit('clickjack-output', { type: 'info', output: `📝 ${result.summary}` });
        const testHTML = clickjackTester.generateTestHTML(url);
        socket.emit('clickjack-test-html', { html: testHTML, url });
    });

    socket.on('clickjack-batch', async (data) => {
        const results = await clickjackTester.batchTest(data.urls);
        socket.emit('clickjack-batch-result', { results });
    });

    socket.on('subdomain-find', async (data) => {
        const subdomainModule = require('./modules/subdomain');
        const { domain, method, wordlist } = data;
        if (method === 'crt.sh' || method === 'all') {
            const result = await subdomainModule.findWithCrtSh(domain);
            socket.emit('subdomain-result', { ...result, method: 'crt.sh' });
        }
        if (method === 'dns' || method === 'all') {
            socket.emit('subdomain-output', { type: 'info', output: 'DNS bruteforce started...' });
            const result = await subdomainModule.findWithDnsBruteforce(domain, wordlist);
            socket.emit('subdomain-result', { ...result, method: 'dns' });
        }
    });

    socket.on('hash-identify', async (data) => {
        const hashModule = require('./modules/hashid');
        const result = hashModule.identify(data.hash);
        socket.emit('hash-result', result);
    });

    socket.on('hash-crack', async (data) => {
        const hashModule = require('./modules/hashid');
        const result = await hashModule.crackWithWordlist(data.hash, data.wordlist);
        socket.emit('hash-result', result);
    });

    socket.on('password-generate', (data) => {
        const pwModule = require('./modules/pwgen');
        const result = pwModule.generate(data.options || {});
        socket.emit('password-result', result);
    });

    socket.on('bandwidth-start', () => {
        const bwModule = require('./modules/bandwidth');
        bwModule.startStream((data) => {
            socket.emit('bandwidth-data', data);
        });
    });

    socket.on('bandwidth-stop', () => {
        const bwModule = require('./modules/bandwidth');
        bwModule.stopStream();
    });

    socket.on('dns-lookup', async (data) => {
        const dnsModule = require('./modules/dnslookup');
        const result = await dnsModule.lookup(data.domain, data.types);
        socket.emit('dns-result', result);
    });

    socket.on('encoder-encode', (data) => {
        const encoderModule = require('./modules/encoder');
        const result = encoderModule.encode(data.type, data.text);
        socket.emit('encoder-result', result);
    });

    socket.on('encoder-decode', (data) => {
        const encoderModule = require('./modules/encoder');
        const result = encoderModule.decode(data.type, data.text);
        socket.emit('encoder-result', result);
    });

    socket.on('reverseip-lookup', async (data) => {
        const reverseModule = require('./modules/reverseip');
        const result = await reverseModule.lookup(data.target);
        socket.emit('reverseip-result', result);
    });

    socket.on('reverseip-api', async (data) => {
        const reverseModule = require('./modules/reverseip');
        const result = await reverseModule.lookupViaApi(data.ip);
        socket.emit('reverseip-result', result);
    });

    socket.on('ctf-execute', (data) => {
      const { category } = data;
      switch (category) {
        case 'forensic': forensicModule.execute(socket, data); break;
        case 'crypto': ctfCryptoModule.execute(socket, data); break;
        case 'pwn': pwnModule.execute(socket, data); break;
        case 'reverse': reverseModule.execute(socket, data); break;
        default: socket.emit('ctf-output', { type: 'error', output: `[!] Unknown CTF category: ${category}` });
      }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Client disconnected: ${socket.id}`);
        terminalHandler.cancel(socket.id);
        const nmapProc = activeNmapProcesses.get(socket.id);
        if (nmapProc) { nmapProc.kill('SIGTERM'); activeNmapProcesses.delete(socket.id); }
        const bwModule = require('./modules/bandwidth');
        bwModule.stopStream();
    });
});

const PORT = process.env.PORT || 6969;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.clear();
    console.log(`
    ┌──────────────────────────────────────────┐
    │  toolkit v3.1                            │
    │  listening on http://localhost:${PORT}    │
    └──────────────────────────────────────────┘
    `);
    const { exec } = require('child_process');
    exec(`xdg-open http://localhost:${PORT} 2>/dev/null || firefox http://localhost:${PORT} 2>/dev/null &`);
});

process.on('SIGINT', () => {
    console.log('\n[!] Shutting down...');
    for (const [id, proc] of activeNmapProcesses) { try { proc.kill('SIGTERM'); } catch(e) {} }
    io.close();
    server.close(() => process.exit(0));
});

module.exports = { app, server, io };
