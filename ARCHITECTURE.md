# Toolkit Architecture Roadmap

## Critical Analysis of Current Codebase

**Before designing the future, here is what is wrong today:**

| Masalah | Lokasi | Dampak |
|---|---|---|
| `server.js` berisi ~300 baris monolitik dengan manual wiring 18+ module | `server.js:47-281` | Setiap module baru = edit server.js. Tidak mungkin dikelola di 100+ module |
| Setiap module di-`require()` secara eksplisit dengan path hardcoded | `server.js:14-20, 64, 74, ...` | Module tidak bisa dipasang/dilepas tanpa edit kode |
| Socket event handler adalah if-else / switch raksasa | `server.js:62-271` | Violates Open/Closed Principle |
| Tidak ada permission system | seluruh app | Siapa pun yang connect bisa akses nmap, browser, dll. |
| Logging hanya `console.log` | seluruh app | Tidak ada audit trail, sulit debugging production |
| Task queue tidak ada; child process dibuat ad-hoc | `server.js:119, routes/terminal.js:14` | Tidak ada prioritization, concurrency control, atau timeout management |
| Konfigurasi hardcoded (port, temp dir, rate limit) | `server.js:283, 36-38` | Tidak bisa di-deploy ke environment berbeda |
| Tidak ada testing | — | Setiap refactor beresiko regresi |
| Module tidak punya lifecycle hooks | — | Tidak bisa inisialisasi/cleanup dengan benar |
| Error handling tidak konsisten | antar module | Ada yang throw, ada yang return `{error}` |

---

## 1. Folder Structure Refactor

### Why
Folder flat `modules/` dengan 18 file campur aduk (forensic, crypto, browser, network, dll) tidak scalable. Pada 100+ module, developer akan kesulitan mencari file, memahami relasi, dan menghindari naming conflict.

### Design
```
src/
├── core/                      # ❗ Framework inti, bukan module
│   ├── plugin-engine.js       # Plugin system
│   ├── command-registry.js    # Command registry
│   ├── permission-manager.js  # Permission & roles
│   ├── logger.js              # Logger & audit
│   ├── task-queue.js          # Async task queue
│   ├── config-loader.js       # Config management
│   ├── event-bus.js           # Internal event bus
│   └── updater.js             # Auto-update system
│
├── modules/                   # ❗ Semua module dipisah per kategori
│   ├── forensic/              # → module.json, commands/**, utils/**
│   ├── crypto/                # → module.json, commands/**, utils/**
│   ├── pwn/                   # → module.json
│   ├── reverse/               # → module.json
│   ├── network/               # → module.json
│   ├── browser/               # → module.json
│   ├── subdomain/             # → module.json
│   ├── hash/                  # → module.json
│   ├── encoder/               # → module.json
│   ├── dns/                   # → module.json
│   └── ...                    # Setiap kategori = 1 folder
│
├── plugins/                   # ❗ Third-party / external plugins
│   ├── official/              # Maintained by core team
│   └── community/             # Submitted by community
│
├── server/                    # ❗ Express + Socket.IO setup
│   ├── http.js                # Express app, middleware, helmet, cors, rate-limit
│   ├── socket.js              # Socket.IO setup, auth middleware
│   └── routes/                # REST API routes
│       ├── index.js
│       ├── health.js
│       └── admin.js
│
├── shared/                    # ❗ Shared utilities
│   ├── temp-files.js          # Temp file management (existing _saveFile)
│   ├── validators.js
│   └── constants.js
│
├── config/                    # ❗ Configuration files
│   ├── default.json
│   ├── production.json
│   └── permissions.json
│
├── tests/                     # ❗ Testing
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── data/                      # Runtime data (wordlists, cache)
│   ├── wordlists/
│   └── cache/
│
├── server.js                  # Entry point (hanya bootstrap)
└── loader.js                  # Bootstrap semua sistem
```

### Flow
```
server.js
  └─> loader.js
        ├─> config-loader.js       → loads config/
        ├─> logger.js              → inisialisasi logger
        ├─> event-bus.js           → inisialisasi event bus
        ├─> plugin-engine.js       → scan modules/ + plugins/
        │     └─> setiap module:
        │           ├─ baca module.json (name, version, dependencies, permissions)
        │           ├─ daftarkan commands ke command-registry.js
        │           └─ daftarkan permissions ke permission-manager.js
        ├─> task-queue.js          → inisialisasi worker pool
        ├─> server/http.js         → Express app dengan middleware
        └─> server/socket.js       → Socket.IO dengan event routing
              └─> command-registry.js → dispatch ke module yang tepat
```

---

## 2. Plugin System

### Why
Setiap module (forensic, crypto, nmap, dll.) adalah plugin. Tanpa plugin system, server.js harus manual require dan wiring. Plugin system memungkinkan:
- Module discoverable secara otomatis
- Install/uninstall tanpa restart (hot-plug)
- Dependencies antar module
- Versioning dan compatibility check

### Design Pattern: **Plugin Pattern + Registry Pattern + Dependency Injection**

Setiap module adalah folder dengan `module.json` sebagai manifest:

```json
// modules/forensic/module.json
{
  "name": "forensic",
  "version": "1.0.0",
  "description": "Forensic analysis tools",
  "author": "Toolkit Team",
  "license": "MIT",
  "dependencies": {},
  "optionalDependencies": ["binwalk", "exiftool"],
  "permissions": ["forensic.read", "forensic.write"],
  "hooks": {
    "onLoad": "onLoad",
    "onUnload": "onUnload",
    "onCommand": null
  },
  "commands": [
    { "name": "metadata", "handler": "commands/metadata.js", "async": true, "timeout": 30000 },
    { "name": "exif", "handler": "commands/exif.js", "async": true },
    { "name": "strings", "handler": "commands/strings.js", "async": true },
    { "name": "entropy", "handler": "commands/entropy.js", "async": false }
  ]
}
```

### PluginEngine Lifecycle

```
[Scanner]                    [Loader]                    [Module]
    │                           │                           │
    │── scan(directories) ──────┤                           │
    │                           │── read module.json ──────>│
    │                           │<── metadata ──────────────│
    │                           │                           │
    │                           │── resolveDependencies()   │
    │                           │── checkVersions()         │
    │                           │                           │
    │                           │── loadModule() ──────────>│
    │                           │    │── call onLoad()      │
    │                           │    │── register events    │
    │                           │    │── register commands  │
    │                           │<── ready ────────────────│
    │                           │                           │
    │                           │── activateModule() ──────>│
    │                           │    │── call onActivate()  │
    │                           │<── active ───────────────│
    │                           │                           │
```

### Code Sketch

```js
// core/plugin-engine.js
class PluginEngine {
  constructor(registry, permissions, eventBus, logger) {
    this.registry = registry;
    this.permissions = permissions;
    this.eventBus = eventBus;
    this.logger = logger;
    this.modules = new Map();
    this.scanner = new PluginScanner();
  }

  async scan(moduleDirs) {
    const manifests = await this.scanner.scan(moduleDirs);
    for (const manifest of manifests) {
      await this.register(manifest);
    }
  }

  async register(manifest) {
    const container = new PluginContainer(manifest);
    await container.validate();
    await container.resolveDependencies(this.modules);
    await container.load();
    await container.activate();
    this.modules.set(manifest.name, container);
    this.eventBus.emit('plugin:activated', { name: manifest.name, version: manifest.version });
  }

  async unregister(name) {
    const container = this.modules.get(name);
    if (!container) return;
    await container.deactivate();
    await container.unload();
    this.modules.delete(name);
    this.eventBus.emit('plugin:deactivated', { name });
  }

  getCommands() { /* return semua command dari semua module */ }
  getModule(name) { return this.modules.get(name); }
}
```

### Kelebihan
- Zero-touch integration untuk module baru
- Isolasi antar module
- Dependency injection memudahkan testing
- Hot-plug memungkinkan update tanpa restart

### Kekurangan
- Overhead awal untuk setup framework
- Kompleksitas tambahan untuk debugging
- Memory footprint bertambah (tapi negligible)

### Common Mistakes
- ❌ Membuat module bisa saling akses langsung (tight coupling)
- ❌ Tidak menangani circular dependencies
- ❌ Menyimpan state di global, bukan di container module

---

## 3. Command Registry

### Why
Saat ini setiap module punya `execute(socket, data)` dengan switch/case internal (lihat `forensic.js:198-256`). Command registry memisahkan routing command dari eksekusi. Setiap command adalah file terpisah, didaftarkan secara deklaratif.

### Design Pattern: **Registry Pattern + Command Pattern**

### Arsitektur Per Module

```
modules/forensic/
├── module.json              # Manifest
├── index.js                 # Plugin entry point (onLoad, onUnload, etc.)
├── commands/                # Satu file per command
│   ├── metadata.js
│   ├── exif.js
│   ├── strings.js
│   ├── entropy.js
│   ├── signature.js
│   ├── hidden.js
│   ├── yara.js
│   ├── zip.js
│   ├── pcap.js
│   ├── binwalk.js
│   └── all.js
└── utils/
    ├── file-utils.js        # _saveFile, temp file management
    └── runner.js            # _run command execution
```

### Command Handler Contract

```js
// modules/forensic/commands/strings.js
module.exports = {
  name: 'strings',
  description: 'Extract strings from file',
  async: true,
  timeout: 30000,
  input: 'file',        // 'file' | 'text' | 'none'
  permission: 'forensic.read',
  
  async handler({ filePath, args, socket, logger }) {
    const minLen = args.length > 1 ? parseInt(args[1]) : 4;
    const { output } = await exec(`strings -n ${minLen} "${filePath}"`);
    const lines = [...new Set(output.split('\n').filter(l => l.trim()))];
    return {
      total: lines.length,
      strings: lines.slice(0, 1000).join('\n')
    };
  }
};
```

### CommandRegistry

```js
// core/command-registry.js
class CommandRegistry {
  constructor() {
    this.commands = new Map();     // "forensic.strings" -> handler
    this.aliases = new Map();      // "strings" -> "forensic.strings"
  }

  register(moduleName, commandDef) {
    const key = `${moduleName}.${commandDef.name}`;
    this.commands.set(key, commandDef);
    
    // Register alias (tanpa prefix) jika tidak ada konflik
    if (!this.aliases.has(commandDef.name)) {
      this.aliases.set(commandDef.name, key);
    }
    
    return this;
  }

  unregister(moduleName, commandName) {
    const key = `${moduleName}.${commandName}`;
    this.commands.delete(key);
    if (this.aliases.get(commandName) === key) {
      this.aliases.delete(commandName);
    }
  }

  find(input) {
    // "forensic.strings" -> langsung
    if (this.commands.has(input)) return this.commands.get(input);
    // "strings" -> cari alias
    const alias = this.aliases.get(input);
    if (alias) return this.commands.get(alias);
    // "forensic" -> return info module
    return null;
  }

  async execute(commandKey, context) {
    const command = this.find(commandKey);
    if (!command) throw new Error(`Unknown command: ${commandKey}`);
    
    // Permission check
    await context.permissions.check(command.permission, context.user);
    
    // Execute dengan timeout
    const result = await Promise.race([
      command.handler(context),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Command timeout')), command.timeout || 30000)
      )
    ]);
    
    return result;
  }
}
```

### Socket Routing (sekarang tinggal 10 baris)

```js
// server/socket.js
socket.on('command', async (data) => {
  const { command, args } = data;
  try {
    const result = await registry.execute(command, {
      args,
      user: socket.user,        // dari auth middleware
      permissions: permissionManager,
      logger,
      socket,
      // file handling, dll.
    });
    socket.emit('command:result', { command, success: true, data: result });
  } catch (err) {
    socket.emit('command:result', { command, success: false, error: err.message });
    logger.error(`Command failed: ${command}`, { error: err.message, user: socket.user?.id });
  }
});
```

### Flow
```
Client                   Server                      Registry                Module/Command
  │                         │                          │                        │
  │── command:{name,args} ──>│                          │                        │
  │                         │── registry.find(name) ───>│                        │
  │                         │<── handler ──────────────│                        │
  │                         │                          │                        │
  │                         │── permissions.check()    │                        │
  │                         │── validator.validate()   │                        │
  │                         │                          │                        │
  │                         │── handler(context) ──────│───────────────────────>│
  │                         │                          │                        │── process
  │                         │<── result ──────────────│<────────────────────────│
  │                         │                          │                        │
  │<── command:result ─────│                          │                        │
```

### Common Mistakes
- ❌ Command handler punya akses langsung ke socket (violates separation of concerns)
- ❌ Tidak ada timeout per-command
- ❌ Tidak ada validasi input sebelum dispatch

---

## 4. Permission Manager

### Why
Saat ini semua client bisa mengakses semua module. Nmap scan, browser opener, dan subdomain enumeration adalah operasi sensitif. Permission manager memungkinkan:
- Role-based access (admin, user, guest)
- Granular permission per command
- Integrasi dengan autentikasi (API key, JWT, atau session)

### Design Pattern: **Strategy Pattern + ACL (Access Control List)**

```js
// core/permission-manager.js
class PermissionManager {
  constructor() {
    this.roles = new Map();
    this.defaultRole = 'guest';
    
    // Default roles
    this.defineRole('admin', ['*']);                    // all access
    this.defineRole('user', [
      'forensic.*', 'crypto.*', 'encoder.*',
      'dns.read', 'hash.read',
    ]);
    this.defineRole('guest', [
      'forensic.read', 'crypto.read', 'encoder.encode',
    ]);
  }

  defineRole(name, permissions) {
    this.roles.set(name, new Role(name, permissions));
  }

  async check(user, requiredPermission) {
    if (!user || !user.role) {
      user = { role: this.defaultRole };
    }
    const role = this.roles.get(user.role);
    if (!role) throw new PermissionError(`Unknown role: ${user.role}`);
    return role.hasPermission(requiredPermission);
  }

  middleware(requiredPermission) {
    return (req, res, next) => {
      try {
        this.check(req.user, requiredPermission);
        next();
      } catch (err) {
        res.status(403).json({ error: 'Forbidden', permission: requiredPermission });
      }
    };
  }

  socketMiddleware(requiredPermission) {
    return (socket, next) => {
      try {
        this.check(socket.user, requiredPermission);
        next();
      } catch (err) {
        next(new Error(`Permission denied: ${requiredPermission}`));
      }
    };
  }
}

class Role {
  constructor(name, permissions) {
    this.name = name;
    this.rules = permissions.map(p => new PermissionRule(p));
  }

  hasPermission(required) {
    return this.rules.some(rule => rule.matches(required));
  }
}

class PermissionRule {
  constructor(pattern) {
    this.pattern = pattern;  // "forensic.*"
    this.regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  }
  matches(permission) {
    return this.regex.test(permission);
  }
}
```

### Permission Configuration

```json
// config/permissions.json
{
  "roles": {
    "admin": ["*"],
    "operator": [
      "forensic.*", "crypto.*", "network.*",
      "nmap.scan", "subdomain.*"
    ],
    "analyst": [
      "forensic.read", "crypto.read", "encoder.*",
      "dns.read", "hash.read"
    ],
    "guest": [
      "system.read", "dns.read", "encoder.encode"
    ]
  },
  "defaultRole": "guest",
  "permissions": {
    "nmap": { "description": "Nmap port scanning", "risk": "high" },
    "browser": { "description": "Open URLs on server", "risk": "critical" },
    "forensic.write": { "description": "Upload files for analysis", "risk": "medium" }
  }
}
```

### Common Mistakes
- ❌ Permission check dilakukan di handler (seharusnya di middleware layer)
- ❌ Wildcard terlalu permisif (`*` tanpa validasi konteks)
- ❌ Role hardcoded, tidak bisa dikustomisasi via config

---

## 5. Logger & Audit System

### Why
`console.log` tidak cukup untuk:
- Debugging production
- Audit trail untuk security (siapa menjalankan command apa)
- Monitoring error rate
- Performance tracing

### Design Pattern: **Observer Pattern (Event Bus) + Decorator Pattern**

```js
// core/logger.js
const winston = require('winston');
const path = require('path');

class Logger {
  constructor(config) {
    this.logDir = config.logDir || path.join(process.cwd(), 'logs');
    
    this.logger = winston.createLogger({
      level: config.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(this.logDir, 'error.log'), 
          level: 'error',
          maxsize: 10 * 1024 * 1024,  // 10MB rotate
          maxFiles: 5,
        }),
        new winston.transports.File({ 
          filename: path.join(this.logDir, 'combined.log'),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 10,
        }),
        new winston.transports.File({
          filename: path.join(this.logDir, 'audit.log'),
          level: 'audit',   // custom level untuk audit trail
        }),
      ],
    });

    // Console transport for dev
    if (config.console) {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }));
    }
  }

  info(msg, meta) { this.logger.info(msg, meta); }
  warn(msg, meta) { this.logger.warn(msg, meta); }
  error(msg, meta) { this.logger.error(msg, meta); }

  // Audit trail khusus
  audit(action, meta) {
    this.logger.log('audit', action, {
      ...meta,
      timestamp: new Date().toISOString(),
      user: meta.user || 'anonymous',
      sessionId: meta.sessionId,
    });
  }

  // Command execution audit
  commandExecuted(command, user, result) {
    this.audit('command.executed', { command, user, result: result.success });
  }
}
```

### Audit Events

| Event | Data | Tujuan |
|---|---|---|
| `command.executed` | user, command, args, duration, success | Tracking penggunaan feature |
| `auth.login` | user, ip, method | Security monitoring |
| `auth.failed` | ip, attempt | Brute force detection |
| `plugin.activated` | name, version | Change tracking |
| `plugin.deactivated` | name, reason | Change tracking |
| `config.changed` | key, oldValue, newValue | Audit konfigurasi |
| `file.uploaded` | user, filename, size | File operation audit |
| `error.unhandled` | error, stack, context | Error tracking |

### Common Mistakes
- ❌ Logging sensitive data (password, token, file content)
- ❌ Tidak ada log rotation (disk akan penuh)
- ❌ Synchronous logging di production (blocking I/O)

---

## 6. Task Queue

### Why
Command seperti `nmap scan`, `forensic all`, `subdomain brute-force`, dan `hash crack` bisa memakan waktu 30 detik - 30 menit. Tanpa task queue:
- Socket.IO timeout (default 60s) akan putus
- Server bisa freeze jika terlalu banyak request
- Tidak ada prioritization (scan penting bisa didahulukan)
- Tidak ada progress reporting yang terstruktur

### Design Pattern: **Queue Pattern (Bull/BullMQ + Redis) + Worker Pattern**

Untuk fase awal (tanpa Redis), bisa pakai **in-memory queue** dengan `p-queue` atau implementasi sederhana.

### Arsitektur

```
Client                          Server                         Queue                   Worker Pool
  │                               │                             │                         │
  │── command: nmap.scan ────────>│                             │                         │
  │                               │── queue.add({               │                         │
  │                               │     type: 'nmap.scan',      │                         │
  │                               │     data: {target, ports},  │                         │
  │                               │     priority: 5,            │                         │
  │                               │     socketId: 'xxx'         │                         │
  │                               │   })                        │                         │
  │                               │                             │── process(job) ────────>│
  │<── command:status ───────────│<──── {status:'queued',pos}───│                         │
  │  {status:'queued',pos:2}     │                             │                         │
  │                               │                             │                         │── nmap scan
  │<── command:progress ─────────│<──── {status:'running'} ─────│                         │
  │  {status:'running'}          │                             │                         │
  │                               │                             │                         │── stdout lines
  │<── command:progress ─────────│<──── progress: 45% ──────────│<── emit('progress') ────│
  │  {progress:45}               │                             │                         │
  │                               │                             │                         │── complete
  │<── command:result ──────────│<──── {status:'done',result}───│<── resolve ────────────│
  │  {status:'done',data:...}   │                             │                         │
```

### Implementasi In-Memory (Tahap Awal)

```js
// core/task-queue.js
const EventEmitter = require('events');

class TaskQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || 3;
    this.timeout = options.defaultTimeout || 5 * 60 * 1000; // 5 menit
    this.queue = [];
    this.active = new Map();
    this.completed = [];
    this.maxCompleted = 100;
  }

  add(task) {
    const job = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: task.type,
      data: task.data,
      priority: task.priority || 5,
      socketId: task.socketId,
      createdAt: Date.now(),
      status: 'queued',
      progress: 0,
    };
    
    // Insert by priority (higher = first)
    const idx = this.queue.findIndex(t => t.priority < job.priority);
    if (idx === -1) this.queue.push(job);
    else this.queue.splice(idx, 0, job);
    
    this.emit('task:queued', job);
    this.processNext();
    return job;
  }

  async processNext() {
    if (this.active.size >= this.concurrency) return;
    if (this.queue.length === 0) return;
    
    const job = this.queue.shift();
    job.status = 'running';
    job.startedAt = Date.now();
    this.active.set(job.id, job);
    this.emit('task:started', job);
    
    try {
      const result = await this._execute(job);
      job.status = 'completed';
      job.result = result;
      job.completedAt = Date.now();
      this.emit('task:completed', job);
      this._archive(job);
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
      job.failedAt = Date.now();
      this.emit('task:failed', job);
      this._archive(job);
    } finally {
      this.active.delete(job.id);
      this.processNext();  // Process next in queue
    }
  }

  async _execute(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) throw new Error(`No handler for task type: ${job.type}`);
    
    // Wrap with timeout
    const timeout = job.data.timeout || this.timeout;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Task timeout after ${timeout}ms`)), timeout)
    );
    
    return Promise.race([
      handler(job.data, (progress) => {
        job.progress = progress;
        this.emit('task:progress', job);
      }),
      timeoutPromise
    ]);
  }

  registerHandler(type, handler) {
    if (!this.handlers) this.handlers = new Map();
    this.handlers.set(type, handler);
  }

  getStatus(jobId) {
    // Check active
    if (this.active.has(jobId)) return this.active.get(jobId);
    // Check queue
    const queued = this.queue.find(j => j.id === jobId);
    if (queued) return queued;
    // Check completed
    return this.completed.find(j => j.id === jobId) || null;
  }

  cancel(jobId) {
    const idx = this.queue.findIndex(j => j.id === jobId);
    if (idx !== -1) {
      const job = this.queue.splice(idx, 1)[0];
      job.status = 'cancelled';
      this.emit('task:cancelled', job);
      return true;
    }
    return false;
  }

  _archive(job) {
    this.completed.unshift(job);
    if (this.completed.length > this.maxCompleted) {
      this.completed.pop();
    }
  }
}

module.exports = TaskQueue;
```

### Common Mistakes
- ❌ Task queue tanpa timeout (task menggantung selamanya)
- ❌ Tidak ada mekanisme retry untuk transient failures
- ❌ Queue in-memory hilang saat server restart (butuh Redis untuk production)
- ❌ Concurrent tasks melebihi resource limit (misal: 50 nmap bersamaan)

---

## 7. Auto Update System

### Why
Toolkit akan terus berkembang. Auto update memungkinkan:
- Update security patch tanpa intervensi manual
- Module auto-update dari registry
- Rollback jika update gagal
- Verifikasi integritas (checksum/signature)

### Design Pattern: **Strategy Pattern (multiple update sources) + Saga Pattern (rollback)**

### Update Sources
1. **GitHub Releases** — untuk aplikasi inti
2. **Module Registry** — untuk module individual (npm registry atau custom registry)
3. **Local ZIP** — untuk offline update

### Arsitektur

```
Updater
├── update-source.js (abstract)
│   ├── github-source.js     → fetch dari GitHub Releases API
│   ├── npm-source.js        → fetch dari npm registry
│   ├── registry-source.js   → fetch dari custom module registry
│   └── local-source.js      → dari file ZIP lokal
│
├── version-validator.js     → semantic versioning comparison
├── integrity-checker.js     → SHA-256 / GPG signature verification
├── backup-manager.js        → backup before update, restore on rollback
├── rollback-manager.js      → rollback ke versi sebelumnya
└── updater.js               → orchestrator
```

### Flow Update

```
[Check]                          [Download]                     [Apply]
  │                                │                              │
  │── GET /api/updates/check ─────>│                              │
  │<── {version, changelog, size} │                              │
  │                                │                              │
  │── confirm download            │                              │
  │                                │                              │
  │                        ┌──────┤                              │
  │                        │ backup current version              │
  │                        │ verify checksum                     │
  │                        │ download to temp                    │
  │                        │ verify signature                    │
  │                        └──────┤                              │
  │                                │                              │
  │                                │── extract & apply ──────────>│
  │                                │                              │── stop services
  │                                │                              │── replace files
  │                                │<── applied ─────────────────│── restart services
  │                                │                              │
  │<── {success,version} ─────────│                              │
```

### Code Sketch

```js
// core/updater.js
class Updater {
  constructor(config, logger, pluginEngine) {
    this.sources = config.sources || [new GitHubSource()];
    this.logger = logger;
    this.pluginEngine = pluginEngine;
    this.backupDir = config.backupDir || path.join(process.cwd(), '.backup');
  }

  async checkAll() {
    const updates = [];
    for (const source of this.sources) {
      const available = await source.check();
      updates.push(...available);
    }
    return updates;
  }

  async update(target, version) {
    const source = this.sources.find(s => s.canHandle(target));
    if (!source) throw new Error(`No source for: ${target}`);

    // Backup before update
    const backup = await this.backup(target);

    try {
      const artifact = await source.download(target, version);
      
      // Verify integrity
      if (!await artifact.verify()) {
        throw new Error('Integrity check failed');
      }

      // Apply update
      if (target === 'core') {
        await this.applyCoreUpdate(artifact);
      } else {
        await this.pluginEngine.updateModule(target, version, artifact);
      }

      this.logger.info('Update applied', { target, version });
      return { success: true, version };
    } catch (err) {
      // Rollback
      await this.rollback(backup);
      this.logger.error('Update failed, rolled back', { target, version, error: err.message });
      return { success: false, error: err.message, rolledBack: true };
    }
  }

  async backup(target) {
    const backupPath = path.join(this.backupDir, `${target}-${Date.now()}`);
    // Copy current files to backup path
    return { path: backupPath, target, timestamp: Date.now() };
  }

  async rollback(backup) {
    // Restore files from backup
    this.logger.audit('update.rollback', { target: backup.target });
  }
}
```

### Common Mistakes
- ❌ Update langsung replace file tanpa backup
- ❌ Tidak validasi checksum (rentan man-in-the-middle)
- ❌ Update membutuhkan dependency baru tapi tidak di-check
- ❌ Tidak ada mekanisme rollback otomatis

---

## 8. Testing & CI/CD

### Why
Tanpa testing, setiap refactor beresiko regresi. Dengan arsitektur plugin yang kompleks, testing adalah keharusan.

### Design Pattern: **AAA (Arrange-Act-Assert) + Mock/Stub**

### Test Structure

```
tests/
├── unit/
│   ├── core/
│   │   ├── command-registry.test.js
│   │   ├── permission-manager.test.js
│   │   ├── plugin-engine.test.js
│   │   ├── task-queue.test.js
│   │   └── logger.test.js
│   ├── modules/
│   │   ├── forensic/
│   │   │   ├── metadata.test.js
│   │   │   ├── entropy.test.js
│   │   │   └── signature.test.js
│   │   ├── crypto/
│   │   │   ├── base64.test.js
│   │   │   └── caesar.test.js
│   │   └── ...
│   └── server/
│       ├── health.test.js
│       └── socket.test.js
│
├── integration/
│   ├── forensic-workflow.test.js
│   ├── crypto-workflow.test.js
│   └── plugin-lifecycle.test.js
│
└── fixtures/
    ├── sample.jpg
    ├── sample.zip
    ├── sample.pcap
    └── test-module/
        └── module.json
```

### Tooling

| Kebutuhan | Tool | Alasan |
|---|---|---|
| Test runner | **Jest** | Built-in mock, coverage, snapshot, parallel |
| HTTP testing | **supertest** | Express integration test |
| Socket testing | **socket.io-client** | Test Socket.IO events |
| Code coverage | **c8** (atau istanbul via Jest) | Threshold enforcement |
| Linting | **ESLint** + **Prettier** | Code style consistency |
| CI | **GitHub Actions** | Free, integrated |

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx eslint src/ modules/ server/

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  test-e2e:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test:e2e

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - run: npx snyk test  # optional
```

### Contoh Unit Test

```js
// tests/unit/core/command-registry.test.js
const CommandRegistry = require('../../../src/core/command-registry');

describe('CommandRegistry', () => {
  let registry;
  
  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('register', () => {
    it('should register a command with module prefix', () => {
      registry.register('forensic', {
        name: 'strings',
        handler: jest.fn(),
        permission: 'forensic.read'
      });
      
      const cmd = registry.find('forensic.strings');
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe('strings');
    });

    it('should register a short alias if no conflict', () => {
      registry.register('forensic', {
        name: 'strings',
        handler: jest.fn()
      });
      
      expect(registry.find('strings')).toBeDefined();
    });

    it('should not overwrite existing alias', () => {
      registry.register('forensic', {
        name: 'strings',
        handler: jest.fn()
      });
      registry.register('crypto', {
        name: 'strings',  // same name, different module
        handler: jest.fn()
      });
      
      // forensic.strings keeps the alias
      const cmd = registry.find('strings');
      expect(cmd).toBe(registry.commands.get('forensic.strings'));
    });
  });

  describe('execute', () => {
    it('should call handler with context', async () => {
      const handler = jest.fn().mockResolvedValue('result');
      registry.register('test', { name: 'ping', handler, permission: null });
      
      const context = { user: { role: 'admin' }, permissions: { check: jest.fn() } };
      const result = await registry.execute('test.ping', context);
      
      expect(handler).toHaveBeenCalledWith(context);
      expect(result).toBe('result');
    });

    it('should throw on unknown command', async () => {
      await expect(
        registry.execute('unknown.command', {})
      ).rejects.toThrow('Unknown command');
    });
  });
});
```

### Common Mistakes
- ❌ Test bergantung pada environment (misal: butuh exiftool di system)
- ❌ Mock terlalu sedikit sehingga test lambat (akses disk/network)
- ❌ Mock terlalu banyak sehingga test tidak meaningful
- ❌ Tidak ada test untuk failure scenarios (timeout, permission denied, invalid input)

---

## Implementation Priority (Phased Rollout)

### Phase 1: Foundation (v4.0.0) — Minggu 1-2
**Tujuan**: Struktur baru tanpa mengubah fungsionalitas

```
[1] Folder restructure
    ├── src/core/config-loader.js     → Baca JSON config
    ├── src/core/logger.js            → Winston logger (ganti console.log)
    ├── src/core/event-bus.js         → Internal event emitter
    └── src/server/http.js            → Pindahkan Express setup dari server.js

[2] Package.json update
    ├── winston, config (npm config)
    ├── jest, supertest, eslint (dev)
    └── scripts: test, lint, coverage
```

**Deliverable**: Server jalan dengan struktur folder baru, logging ke file, config dari JSON.

### Phase 2: Plugin Engine & Command Registry (v4.1.0) — Minggu 3-4
**Tujuan**: Module auto-discovery, server.js tidak perlu manual wiring

```
[1] src/core/command-registry.js
[2] src/core/plugin-engine.js + PluginScanner
[3] Konversi 3 module pertama sebagai contoh (forensic, crypto, encoder)
    ├── modules/forensic/module.json
    ├── modules/forensic/index.js
    └── modules/forensic/commands/*.js

[4] Update server/socket.js
    └── Hanya 1 handler: socket.on('command', ...) → command-registry.execute()
```

**Deliverable**: Semua module lama masih jalan, tapi loading otomatis via plugin engine.

### Phase 3: Task Queue & Permission (v4.2.0) — Minggu 5-6
**Tujuan**: Command berat tidak freeze, akses terbatas per role

```
[1] src/core/task-queue.js
    ├── Concurrency control
    ├── Priority queue
    ├── Progress reporting
    └── Timeout per job

[2] src/core/permission-manager.js
    ├── Role definitions via config/permissions.json
    ├── Socket middleware
    └── Express middleware

[3] Integrasi dengan command-registry
    ├── Setiap command punya permission
    └── Long-running command auto-routed ke task queue
```

**Deliverable**: Nmap scan via queue, guest hanya bisa forensic read.

### Phase 4: Auto Update & Testing (v4.3.0) — Minggu 7-8
**Tujuan**: Update mudah, kualitas terjamin

```
[1] src/core/updater.js
    ├── GitHub Releases source
    ├── Backup & rollback
    └── Integrity verification

[2] .github/workflows/ci.yml
    ├── Lint → Test → Coverage
    └── Security audit

[3] Unit tests untuk core system
    ├── command-registry.test.js
    ├── permission-manager.test.js
    ├── plugin-engine.test.js
    └── task-queue.test.js

[4] Integration tests untuk 3 module utama
```

**Deliverable**: Auto-update working, CI passing, coverage > 70%.

### Phase 5: Polish & Scale (v5.0.0) — Minggu 9-10
**Tujuan**: Production-ready, scalable

```
[1] Redis-backed task queue (Bull)
[2] Database-backed audit trail (SQLite / PostgreSQL)
[3] Web dashboard untuk monitoring
[4] API rate limiting per-user, bukan global
[5] Hot-reload module (update tanpa restart)
```

---

## Summary Table

| Fitur | Prioritas | Design Pattern | Dependencies | Complexity |
|---|---|---|---|---|
| Folder restructure | v4.0.0 | — | — | Mudah |
| Logger | v4.0.0 | Observer | winston | Mudah |
| Config loader | v4.0.0 | Singleton | config | Mudah |
| Event bus | v4.0.0 | Observer | — | Mudah |
| Command Registry | v4.1.0 | Registry + Command | — | Sedang |
| Plugin Engine | v4.1.0 | Plugin + DI | Registry | Sulit |
| Task Queue | v4.2.0 | Queue + Worker | — | Sedang |
| Permission Manager | v4.2.0 | Strategy + ACL | — | Mudah |
| Auto Update | v4.3.0 | Strategy + Saga | — | Sulit |
| Testing | v4.3.0 | AAA + Mock | Jest | Sedang |
| CI/CD | v4.3.0 | — | GitHub Actions | Mudah |
| Redis Queue | v5.0.0 | Queue | Bull + Redis | Sedang |
| DB Audit | v5.0.0 | — | SQLite/Postgres | Sedang |

---

## Recommended Migration Strategy

Jangan refactor semuanya sekaligus. Gunakan **Strangler Fig Pattern**:

1. Buat folder `src/core/` dan `src/server/` baru
2. Biarkan `server.js` lawas tetap jalan
3. Implementasi baru di `src/` secara paralel
4. Setiap module lama dikonversi satu per satu ke format baru
5. Setelah semua module terkonversi, `server.js` lawas diganti menjadi entry point baru (`server.js` → panggil `loader.js`)
6. Hapus kode lawas

Dengan cara ini, aplikasi tetap berfungsi selama migrasi dan tidak perlu "big bang rewrite".
