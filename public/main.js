// toolkit v3.1 - Main Client Script
const state = { socket: null, connected: false, currentPanel: 'terminal', terminalHistory: [], historyIndex: -1 };
let nmapInstalled = false, nmapScanning = false;

function createBufferedAppender(getContainer) {
    let buf = [], pending = false;
    function flush() {
        pending = false;
        const o = getContainer();
        if (!o) return;
        const frag = document.createDocumentFragment();
        for (const { text, cls } of buf) {
            const s = document.createElement('span');
            s.className = cls;
            s.textContent = text;
            frag.appendChild(s);
        }
        o.appendChild(frag);
        requestAnimationFrame(() => { o.scrollTop = o.scrollHeight; });
        buf = [];
    }
    return (text, cls) => {
        buf.push({ text, cls: cls || 'stdout' });
        if (!pending) { pending = true; requestAnimationFrame(flush); }
    };
}

const appendTerminalBuf = createBufferedAppender(() => document.getElementById('terminal-output'));
const appendNmapBuf = createBufferedAppender(() => document.getElementById('nmap-output'));
const appendSubdomainBuf = createBufferedAppender(() => document.getElementById('subdomain-output'));

document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    initNavigation();
    initTerminal();
});

function initSocket() {
    state.socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
    state.socket.on('connect', () => { state.connected = true; updateConnectionStatus('connected'); showToast('connected', 'success'); });
    state.socket.on('disconnect', () => { state.connected = false; updateConnectionStatus('disconnected'); });
    state.socket.on('command-output', (d) => appendTerminal(d.output, d.type));
    state.socket.on('command-complete', () => {});
    state.socket.on('system-info', displaySystemInfo);
    state.socket.on('network-info', displayNetworkOutput);
    state.socket.on('wifi-info', displayWifiInfo);
    state.socket.on('browser-opened', () => showToast('opened', 'info'));
    state.socket.on('nmap-status', (d) => { nmapInstalled = d.installed; document.getElementById('nmap-install-status').innerHTML = d.installed ? '<span class="badge badge-success">installed</span>' : '<span class="badge badge-error">not installed</span> ' + d.message; });
    state.socket.on('nmap-output', (d) => { appendNmapBuf(d.output + '\n', d.type || 'stdout'); });
    state.socket.on('nmap-complete', () => { nmapScanning = false; });
    state.socket.on('qr-result', (d) => { if (d.success) { document.getElementById('qr-preview').innerHTML = `<img src="${d.dataUrl}" style="max-width:300px;border:1px solid #444;border-radius:4px">`; } });
    state.socket.on('clickjack-result', (d) => {
        document.getElementById('clickjack-result-card').style.display = 'block';
        document.getElementById('clickjack-verdict').innerHTML = `${d.verdictIcon||''} ${d.verdict}`;
        document.getElementById('clickjack-verdict').style.color = d.verdictColor;
        document.getElementById('clickjack-summary').textContent = d.summary;
        let det = ''; d.details.forEach(x => { det += `<div style="padding:6px;border-left:2px solid ${x.status==='PASS'?'#4a9a6a':'#c84a4a'};margin:4px 0"><strong>${x.check}</strong>: ${x.value||'N/A'}</div>`; });
        document.getElementById('clickjack-details').innerHTML = det;
        let rec = ''; d.recommendations.forEach(r => { rec += `<div style="padding:4px;color:var(--text-warning)">${r}</div>`; });
        document.getElementById('clickjack-recommendations').innerHTML = rec || 'none';
    });
    state.socket.on('client-info', (d) => { document.getElementById('client-ip').textContent = d.ip; });

    // Subdomain
    state.socket.on('subdomain-result', (d) => {
        if (!d.success) {
            appendSubdomainBuf(`[${d.source||d.method}] Error: ${d.error}\n`, 'cmd-error');
            return;
        }
        if (d.method === 'crt.sh' || d.source === 'crt.sh') {
            appendSubdomainBuf(`[crt.sh] Found ${d.total} subdomains\n`, 'cmd-info');
            if (d.subdomains) d.subdomains.forEach(s => appendSubdomainBuf(`  ${s}\n`, 'stdout'));
        } else if (d.method === 'dns' || d.source === 'dns-bruteforce') {
            appendSubdomainBuf(`[DNS] Found ${d.total} subdomains\n`, 'cmd-info');
            if (d.subdomains) d.subdomains.forEach(s => appendSubdomainBuf(`  ${s.subdomain} (${(s.ips||[]).join(', ')})\n`, 'stdout'));
        }
    });
    state.socket.on('subdomain-output', (d) => {
        appendSubdomainBuf(d.output + '\n', 'cmd-' + d.type);
    });

    // Hash
    state.socket.on('hash-result', (d) => {
        const o = document.getElementById('hash-result');
        if (!d.success) { o.innerHTML = `<span class="cmd-error">${d.error}</span>`; return; }
        let html = '<div class="card"><div class="card-title">Analysis</div>';
        html += `<div class="info-row"><span class="info-label">Hash</span><span class="info-value">${d.hash}</span></div>`;
        html += `<div class="info-row"><span class="info-label">Length</span><span class="info-value">${d.length}</span></div>`;
        html += `<div class="info-row"><span class="info-label">Charset</span><span class="info-value">${d.charset}</span></div>`;
        if (d.possibleTypes && d.possibleTypes.length) {
            html += `<div class="info-row"><span class="info-label">Types</span><span class="info-value">${d.possibleTypes.map(t => t.name).join(', ')}</span></div>`;
        }
        if (d.cracked) {
            html += `<div class="info-row"><span class="info-label" style="color:#4a9a6a">Cracked</span><span class="info-value" style="color:#4a9a6a;font-size:1.1em">${d.password}</span></div>`;
        } else if (d.cracked === false) {
            html += `<div class="info-row"><span class="info-label" style="color:#c84a4a">Not cracked</span><span class="info-value">try a larger wordlist</span></div>`;
        }
        html += '</div>';
        o.innerHTML = html;
    });

    // Password Generator
    state.socket.on('password-result', (d) => {
        const o = document.getElementById('pw-output');
        if (!d.success) { o.innerHTML = `<span class="cmd-error">${d.error}</span>`; return; }
        let html = `<div class="card"><div class="card-title">Generated ${d.count}</div>`;
        html += `<div class="info-row"><span class="info-label">Length</span><span class="info-value">${d.length}</span></div>`;
        html += `<div class="info-row"><span class="info-label">Entropy</span><span class="info-value">${d.entropy} bits (${d.strength})</span></div>`;
        html += '</div>';
        d.passwords.forEach((p, i) => {
            html += `<div style="padding:6px;margin:4px 0;background:#0d0d0d;border:1px solid #2a2a2a;border-radius:3px;font-family:monospace;font-size:1em" onclick="navigator.clipboard.writeText('${p.replace(/'/g, "\\'")}')">${i+1}. ${p}</div>`;
        });
        o.innerHTML = html;
    });

    // Bandwidth
    state.socket.on('bandwidth-data', (d) => {
        const o = document.getElementById('bandwidth-output');
        let html = '<div class="card"><div class="card-title">Traffic</div>';
        for (const [iface, data] of Object.entries(d.interfaces)) {
            const rx = data.rxSpeed > 1024 ? (data.rxSpeed/1024).toFixed(1)+' KB/s' : data.rxSpeed+' B/s';
            const tx = data.txSpeed > 1024 ? (data.txSpeed/1024).toFixed(1)+' KB/s' : data.txSpeed+' B/s';
            html += `<div class="info-row"><span class="info-label">${iface}</span><span class="info-value">rx ${rx} / tx ${tx}</span></div>`;
        }
        html += '</div>';
        o.innerHTML = html;
    });

    // DNS
    state.socket.on('dns-result', (d) => {
        const o = document.getElementById('dns-output');
        if (!d.success) { o.innerHTML = `<span class="cmd-error">${d.error}</span>`; return; }
        let html = `<div class="card"><div class="card-title">DNS Records for ${d.domain}</div>`;
        for (const [type, data] of Object.entries(d.records)) {
            html += `<div style="margin:8px 0"><strong style="color:var(--text-info)">${type}</strong>: `;
            if (data.status === 'found') {
                if (Array.isArray(data.data)) {
                    html += data.data.map(item => {
                        if (typeof item === 'object') return JSON.stringify(item);
                        return item;
                    }).join(', ');
                } else if (typeof data.data === 'object') {
                    html += JSON.stringify(data.data);
                } else {
                    html += data.data;
                }
            } else {
                html += `<span class="cmd-warning">${data.status}</span>`;
            }
            html += '</div>';
        }
        html += `<div class="info-row"><span class="info-label">Time</span><span class="info-value">${d.timestamp}</span></div>`;
        html += '</div>';
        o.innerHTML = html;
    });

    // Encoder
    state.socket.on('encoder-result', (d) => {
        const o = document.getElementById('encoder-output');
        if (!d.success) { o.innerHTML = `<span class="cmd-error">${d.error}</span>`; return; }
        o.innerHTML = `<div class="card"><div class="card-title">${d.direction === 'encode' ? 'Encoded' : 'Decoded'} (${d.type})</div>`;
        o.innerHTML += `<div class="info-row"><span class="info-label">Input</span><span class="info-value" style="word-break:break-all">${d.input}</span></div>`;
        o.innerHTML += `<div class="info-row"><span class="info-label">Output</span><span class="info-value" style="word-break:break-all;color:var(--text-primary)">${d.output}</span></div></div>`;
    });

    // Reverse IP
    state.socket.on('reverseip-result', (d) => {
        const o = document.getElementById('reverseip-output');
        if (!d.success) { o.innerHTML = `<span class="cmd-error">${d.error}</span>`; return; }
        let html = `<div class="card"><div class="card-title">Reverse IP: ${d.target}</div>`;
        if (d.methods) {
            for (const [method, data] of Object.entries(d.methods)) {
                html += `<div style="margin:6px 0"><strong style="color:var(--text-info)">${method}</strong>: `;
                if (data.success) {
                    html += (data.hostnames||[]).join(', ') || data.ip || 'none';
                } else {
                    html += `<span class="cmd-warning">${data.error||'no result'}</span>`;
                }
                html += '</div>';
            }
        }
        if (d.query) {
            html += `<div class="info-row"><span class="info-label">ISP</span><span class="info-value">${d.isp||'N/A'}</span></div>`;
            html += `<div class="info-row"><span class="info-label">Org</span><span class="info-value">${d.org||'N/A'}</span></div>`;
            html += `<div class="info-row"><span class="info-label">Country</span><span class="info-value">${d.country||'N/A'}</span></div>`;
        }
        html += '</div>';
        o.innerHTML = html;
    });

    // CTF Tools
    state.socket.on('ctf-output', (d) => {
      const o = document.getElementById('ctf-output');
      if (!o) return;
      if (d.type === 'error') {
        o.innerHTML = `<span style="color:var(--text-error)">${d.output}</span>`;
      } else {
        o.innerHTML = `<span style="color:var(--text-secondary)">$ ${d.command}</span>\n<pre style="margin:4px 0;white-space:pre-wrap;word-break:break-all">${d.output}</pre>`;
      }
    });
}

function updateConnectionStatus(s) {
    const d = document.querySelector('.status-dot'); const t = document.getElementById('status-text');
    d.className = 'status-dot'; d.classList.add(s === 'connected' ? 'status-online' : 'status-offline');
    t.textContent = s === 'connected' ? 'connected' : 'disconnected';
}

function initNavigation() {
    document.querySelectorAll('.nav-btn[data-panel]').forEach(b => {
        b.addEventListener('click', () => switchPanel(b.dataset.panel));
    });
}

function switchPanel(p) {
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    const panel = document.getElementById('panel-' + p);
    if (panel) panel.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[data-panel="${p}"]`);
    if (btn) btn.classList.add('active');
    state.currentPanel = p;
    if (p === 'system') refreshSystemInfo();
    if (p === 'nmap') state.socket.emit('nmap-check');
    if (p === 'wifi') refreshWifi();
}

function initTerminal() {
    const input = document.getElementById('terminal-input');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { const cmd = input.value.trim(); if (cmd) { executeCommand(cmd); input.value = ''; state.historyIndex = -1; } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory(-1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory(1); }
    });
}

function executeCommand(cmd) {
    state.terminalHistory.push(cmd);
    appendTerminal(`\n$ ${cmd}\n`, 'stdout');
    const builtin = { '/help': () => appendTerminal('/help /clear /sysinfo /net /nmap /wifi /qr /clickjack /ip /browser /subdomain /hash /pwgen /bandwidth /dns /encode /reverseip\n', 'cmd-info'), '/clear': () => document.getElementById('terminal-output').innerHTML = '',
        '/sysinfo': () => switchPanel('system'), '/net': () => switchPanel('network'), '/nmap': () => switchPanel('nmap'),
        '/wifi': () => switchPanel('wifi'), '/qr': () => switchPanel('qrcode'), '/clickjack': () => switchPanel('clickjack'),
        '/ip': () => switchPanel('ipweapon'), '/browser': () => switchPanel('browser'),
        '/subdomain': () => switchPanel('subdomain'), '/hash': () => switchPanel('hash'),
        '/pwgen': () => switchPanel('pwgen'), '/bandwidth': () => switchPanel('bandwidth'),
        '/dns': () => switchPanel('dns'), '/encode': () => switchPanel('encoder'),
        '/reverseip': () => switchPanel('reverseip') };
    const c = cmd.split(' ')[0];
    if (builtin[c]) { builtin[c](); return; }
    if (state.connected) state.socket.emit('execute-command', { command: cmd, sessionId: state.socket.id });
}

function appendTerminal(text, type) { appendTerminalBuf(text, type || 'stdout'); }
function navigateHistory(d) { const input = document.getElementById('terminal-input'); if (!state.terminalHistory.length) return; state.historyIndex += d; if (state.historyIndex >= state.terminalHistory.length) state.historyIndex = state.terminalHistory.length - 1; if (state.historyIndex < -1) state.historyIndex = -1; input.value = state.historyIndex === -1 ? '' : state.terminalHistory[state.terminalHistory.length - 1 - state.historyIndex]; }

function quickCmd(cmd) { document.getElementById('terminal-input').value = cmd; executeCommand(cmd); switchPanel('terminal'); }

function refreshSystemInfo() { if (state.connected) state.socket.emit('get-system-info'); }
function displaySystemInfo(d) {
    if (d.error) return;
    document.getElementById('cpu-info').innerHTML = `<div class="info-row"><span class="info-label">CPU</span><span class="info-value">${d.system.brand}</span></div><div class="info-row"><span class="info-label">Cores</span><span class="info-value">${d.system.cores} / ${d.system.threads}</span></div><div class="info-row"><span class="info-label">Load</span><span class="info-value">${d.system.load}</span></div>`;
    document.getElementById('memory-info').innerHTML = `<div class="info-row"><span class="info-label">Total</span><span class="info-value">${d.memory.total}</span></div><div class="info-row"><span class="info-label">Used</span><span class="info-value">${d.memory.used}</span></div><div class="info-row"><span class="info-label">Usage</span><span class="info-value">${d.memory.usage}</span></div>`;
    let dHtml = ''; if (d.disk) d.disk.forEach(x => { dHtml += `<div class="info-row"><span class="info-label">${x.mount}</span><span class="info-value">${x.used} / ${x.size}</span></div>`; });
    document.getElementById('disk-info').innerHTML = dHtml;
    let nHtml = ''; if (d.network) d.network.forEach(x => { if (x.ip4) nHtml += `<div class="info-row"><span class="info-label">${x.iface}</span><span class="info-value">${x.ip4}</span></div>`; });
    document.getElementById('network-info').innerHTML = nHtml;
}

function execNetworkCmd(cmd) { const t = document.getElementById('network-target').value || 'localhost'; if (state.connected) { document.getElementById('network-output').innerHTML = '<span class="cmd-info">executing...</span>'; state.socket.emit('get-network-info', { command: cmd, target: t }); } }
function displayNetworkOutput(d) { document.getElementById('network-output').innerHTML = `<span class="cmd-info">${d.command}</span>\n${d.output}`; }

function startNmapScan() { if (!nmapInstalled) { showToast('install nmap first', 'error'); return; } const t = document.getElementById('nmap-target').value.trim(); const p = document.getElementById('nmap-ports').value; if (!t) { showToast('enter target', 'error'); return; } document.getElementById('nmap-output').innerHTML = ''; nmapScanning = true; state.socket.emit('nmap-scan', { target: t, ports: p }); }
function cancelNmapScan() { if (nmapScanning) { state.socket.emit('nmap-cancel'); nmapScanning = false; } }

function refreshWifi() { if (state.connected) state.socket.emit('get-wifi-info'); }
function displayWifiInfo(d) { const c = document.getElementById('wifi-output'); if (d.error) { c.innerHTML = `<span class="cmd-error">${d.error}</span>`; return; } let h = `<div class="card"><div class="card-title">${d.total} Profiles</div>`; if (d.profiles) d.profiles.forEach(p => { h += `<div class="info-row"><span>${p.name}</span><span>${p.type}</span></div>`; }); h += '</div>'; c.innerHTML = h; }

function openBrowser() { const u = document.getElementById('browser-url').value; const b = document.getElementById('browser-select').value; if (state.connected) state.socket.emit('open-browser', { url: u, browser: b }); }
function quickOpen(url) { document.getElementById('browser-url').value = url; openBrowser(); }

function generateQR() { const t = document.getElementById('qr-text').value.trim(); const s = document.getElementById('qr-style').value; if (!t) { showToast('enter text', 'error'); return; } state.socket.emit('qr-generate', { text: t, style: s }); }

function testClickjack() { const u = document.getElementById('clickjack-url').value.trim(); if (!u) { showToast('enter URL', 'error'); return; } document.getElementById('clickjack-result-card').style.display = 'block'; document.getElementById('clickjack-verdict').innerHTML = 'testing...'; state.socket.emit('clickjack-test', { url: u }); }

function showToast(msg, type) { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg; c.appendChild(t); setTimeout(() => { if (t.parentNode) t.remove(); }, 3000); }
function confirmShutdown() { if (confirm('Shutdown server?')) showToast('use Ctrl+C in terminal', 'info'); }

// Subdomain Finder
function findSubdomains() {
    const domain = document.getElementById('subdomain-domain').value.trim();
    const method = document.getElementById('subdomain-method').value;
    if (!domain) { showToast('enter domain', 'error'); return; }
    document.getElementById('subdomain-output').innerHTML = `<span class="cmd-info">Searching ${domain} via ${method}...</span>\n`;
    state.socket.emit('subdomain-find', { domain, method });
}

// Hash Identifier & Cracker
function identifyHash() {
    const hash = document.getElementById('hash-input').value.trim();
    if (!hash) { showToast('enter hash', 'error'); return; }
    document.getElementById('hash-result').innerHTML = '<span class="cmd-info">identifying...</span>';
    state.socket.emit('hash-identify', { hash });
}
function crackHash() {
    const hash = document.getElementById('hash-input').value.trim();
    if (!hash) { showToast('enter hash', 'error'); return; }
    document.getElementById('hash-result').innerHTML = '<span class="cmd-info">cracking...</span>';
    state.socket.emit('hash-crack', { hash });
}

// Password Generator
function generatePasswords() {
    const options = {
        length: parseInt(document.getElementById('pw-length').value) || 16,
        uppercase: document.getElementById('pw-upper').checked,
        lowercase: document.getElementById('pw-lower').checked,
        numbers: document.getElementById('pw-numbers').checked,
        symbols: document.getElementById('pw-symbols').checked,
        excludeSimilar: document.getElementById('pw-similar').checked,
        count: parseInt(document.getElementById('pw-count').value) || 5
    };
    state.socket.emit('password-generate', { options });
}

// Bandwidth
function startBandwidth() {
    document.getElementById('bandwidth-output').innerHTML = '<span class="cmd-info">monitoring...</span>';
    state.socket.emit('bandwidth-start');
}
function stopBandwidth() {
    state.socket.emit('bandwidth-stop');
    document.getElementById('bandwidth-output').innerHTML = '<span class="cmd-info">stopped.</span>';
}

// DNS Lookup
function lookupDns() {
    const domain = document.getElementById('dns-domain').value.trim();
    if (!domain) { showToast('enter domain', 'error'); return; }
    const types = Array.from(document.querySelectorAll('.dns-type:checked')).map(cb => cb.value);
    if (!types.length) { showToast('select at least one record type', 'error'); return; }
    document.getElementById('dns-output').innerHTML = '<span class="cmd-info">looking up...</span>';
    state.socket.emit('dns-lookup', { domain, types });
}

// Encoder/Decoder
function encodeText() {
    const text = document.getElementById('encoder-input').value;
    const type = document.getElementById('encoder-type').value;
    if (!text) { showToast('enter text', 'error'); return; }
    document.getElementById('encoder-output').innerHTML = '<span class="cmd-info">encoding...</span>';
    state.socket.emit('encoder-encode', { type, text });
}
function decodeText() {
    const text = document.getElementById('encoder-input').value;
    const type = document.getElementById('encoder-type').value;
    if (!text) { showToast('enter text', 'error'); return; }
    document.getElementById('encoder-output').innerHTML = '<span class="cmd-info">decoding...</span>';
    state.socket.emit('encoder-decode', { type, text });
}

// Reverse IP
function reverseIpLookup() {
    const target = document.getElementById('reverseip-target').value.trim();
    if (!target) { showToast('enter target', 'error'); return; }
    document.getElementById('reverseip-output').innerHTML = '<span class="cmd-info">looking up...</span>';
    state.socket.emit('reverseip-lookup', { target });
}
function reverseIpApi() {
    const target = document.getElementById('reverseip-target').value.trim();
    if (!target) { showToast('enter target', 'error'); return; }
    document.getElementById('reverseip-output').innerHTML = '<span class="cmd-info">looking up via API...</span>';
    state.socket.emit('reverseip-api', { ip: target });
}

// CTF Tools
let ctfFileData = null;
let ctfFileName = '';
let ctfActiveCategory = 'forensic';

function initCtfTabs() {
  document.querySelectorAll('.ctf-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ctf-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ctf-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.ctfTab;
      document.getElementById('ctf-panel-' + cat).classList.add('active');
      ctfActiveCategory = cat;
    });
  });
}

function initCtfFileInput() {
  const input = document.getElementById('ctf-file-input');
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    ctfFileName = file.name;
    document.getElementById('ctf-file-name').textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      ctfFileData = ev.target.result.split(',')[1] || ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function clearCtfFile() {
  ctfFileData = null;
  ctfFileName = '';
  document.getElementById('ctf-file-input').value = '';
  document.getElementById('ctf-file-name').textContent = 'none selected';
}

function initCtfCommands() {
  document.querySelectorAll('.ctf-cmd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.ctfCmd;
      const panel = btn.closest('.ctf-panel');
      const cat = panel ? panel.id.replace('ctf-panel-', '') : ctfActiveCategory;
      let extra = '';
      if (cat === 'crypto') extra = document.getElementById('ctf-crypto-input').value.trim();
      else if (cat === 'pwn') extra = document.getElementById('ctf-pwn-input').value.trim();
      executeCtfCommand(cat, cmd, extra);
    });
  });
}

function executeCtfCommand(category, cmd, extra) {
  const output = document.getElementById('ctf-output');
  output.innerHTML = '<span style="color:#666">processing...</span>\n';

  let fullCmd = cmd;
  if (extra) fullCmd += ' ' + extra;

  if (state.socket && state.connected) {
    state.socket.emit('ctf-execute', {
      category,
      command: fullCmd,
      file: ctfFileData,
      fileName: ctfFileName
    });
  } else {
    output.innerHTML = '<span style="color:var(--text-error)">[!] not connected</span>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCtfTabs();
  initCtfFileInput();
  initCtfCommands();
});

setInterval(() => { document.getElementById('server-time').textContent = new Date().toLocaleTimeString(); }, 1000);
