const fs = require('fs');
const path = require('path');

class PluginScanner {
  async scan(directories) {
    const manifests = [];
    for (const dir of directories) {
      await this._scanDir(dir, manifests);
    }
    return manifests;
  }

  async _scanDir(dir, results) {
    dir = path.resolve(dir);
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const modulePath = path.join(dir, entry.name);
      const manifestPath = path.join(modulePath, 'module.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          manifest._path = modulePath;
          manifest._name = entry.name;
          results.push(manifest);
        } catch (err) {
          console.error(`[plugin] Invalid manifest at ${manifestPath}: ${err.message}`);
        }
      }
    }
  }
}

class PluginContainer {
  constructor(manifest, deps) {
    this.manifest = manifest;
    this.name = manifest._name;
    this.path = manifest._path;
    this.version = manifest.version || '0.0.0';
    this.deps = deps || {};
    this.status = 'registered';
    this.module = null;
    this.commands = [];
    this._config = null;
    this._logger = null;
  }

  async validate() {
    if (!this.manifest.name) throw new Error(`Plugin ${this.name}: name required in module.json`);
    if (!this.manifest.commands) throw new Error(`Plugin ${this.name}: commands array required in module.json`);
    this.status = 'validated';
    return true;
  }

  async resolveDependencies(loadedModules) {
    const deps = this.manifest.dependencies || {};
    for (const [depName, depVersion] of Object.entries(deps)) {
      const dep = loadedModules.get(depName);
      if (!dep) {
        throw new Error(`Plugin ${this.name}: missing dependency '${depName}'`);
      }
    }
    this.status = 'resolved';
    return true;
  }

  async load(config, logger) {
    this._config = config || {};
    this._logger = logger;
    const indexFile = path.join(this.path, 'index.js');
    if (fs.existsSync(indexFile)) {
      try {
        this.module = require(indexFile);
        if (typeof this.module.onLoad === 'function') {
          await this.module.onLoad({
            config: this._config,
            logger: this._logger,
            pluginPath: this.path
          });
        }
      } catch (err) {
        throw new Error(`Plugin ${this.name}: failed to load index.js - ${err.message}`);
      }
    }
    this.status = 'loaded';
    return true;
  }

  async registerCommands(registry) {
    const commandDefs = this.manifest.commands || [];
    for (const def of commandDefs) {
      const handlerPath = path.join(this.path, def.handler);
      if (!fs.existsSync(handlerPath)) {
        throw new Error(`Plugin ${this.name}: command handler not found: ${def.handler}`);
      }

      let handlerFn;
      try {
        handlerFn = require(handlerPath);
      } catch (err) {
        throw new Error(`Plugin ${this.name}: failed to load handler ${def.handler} - ${err.message}`);
      }

      let handler;
      if (typeof handlerFn === 'function') {
        handler = handlerFn;
      } else if (handlerFn && typeof handlerFn.handler === 'function') {
        handler = handlerFn.handler.bind(handlerFn);
      } else {
        throw new Error(`Plugin ${this.name}: handler ${def.handler} must export a function or { handler }`);
      }

      registry.register(this.name, {
        name: def.name,
        description: def.description || '',
        handler: async (context) => {
          return handler({
            ...context,
            moduleName: this.name,
            pluginPath: this.path,
            pluginConfig: this._config
          });
        },
        async: def.async !== false,
        timeout: def.timeout || 30000,
        permission: def.permission || null,
        input: def.input || 'none'
      });

      this.commands.push(def.name);
    }
    return true;
  }

  async activate(_config, _logger) {
    this.status = 'active';
  }

  async deactivate() {
    if (this.module && typeof this.module.onDeactivate === 'function') {
      await this.module.onDeactivate();
    }
    this.status = 'deactivated';
  }

  async unload() {
    if (this.module && typeof this.module.onUnload === 'function') {
      await this.module.onUnload();
    }
    this.status = 'unloaded';
    this.module = null;
  }

  getCommandNames() {
    return this.commands;
  }
}

class PluginEngine {
  constructor(options = {}) {
    this.registry = options.registry;
    this.logger = options.logger || console;
    this.eventBus = options.eventBus || null;
    this.appConfig = options.appConfig || {};
    this.scanner = new PluginScanner();
    this.containers = new Map();
    this.scanDirectories = options.scanDirectories || [];
  }

  async initialize() {
    const manifests = await this.scanner.scan(this.scanDirectories);
    this.logger.info(`[plugin] Found ${manifests.length} plugin(s)`, {
      plugins: manifests.map(m => `${m._name}@${m.version || '0.0.0'}`)
    });

    for (const manifest of manifests) {
      await this.load(manifest);
    }

    if (this.eventBus) {
      this.eventBus.emit('plugin-engine.initialized', {
        count: this.containers.size,
        plugins: Array.from(this.containers.keys())
      });
    }

    return this.containers.size;
  }

  async load(manifest) {
    const container = new PluginContainer(manifest);

    try {
      await container.validate();
      await container.resolveDependencies(this.containers);
      await container.load(this.appConfig, this.logger);
      await container.registerCommands(this.registry);
      await container.activate(this.registry, this.logger);

      this.containers.set(container.name, container);

      this.logger.info(`[plugin] Loaded: ${container.name}@${container.version} (${container.commands.length} commands)`);

      if (this.eventBus) {
        this.eventBus.emit('plugin.loaded', {
          name: container.name,
          version: container.version,
          commands: container.commands
        });
      }
    } catch (err) {
      this.logger.error(`[plugin] Failed to load ${manifest._name}: ${err.message}`);
    }
  }

  async unload(name) {
    const container = this.containers.get(name);
    if (!container) {
      throw new Error(`Plugin not found: ${name}`);
    }

    await container.deactivate();
    this.registry.unregisterModule(name);
    await container.unload();

    this.containers.delete(name);

    if (this.eventBus) {
      this.eventBus.emit('plugin.unloaded', { name });
    }
  }

  get(name) {
    return this.containers.get(name);
  }

  list() {
    return Array.from(this.containers.values()).map(c => ({
      name: c.name,
      version: c.version,
      status: c.status,
      commands: c.commands,
      description: c.manifest.description || ''
    }));
  }

  isLoaded(name) {
    return this.containers.has(name);
  }
}

module.exports = { PluginEngine, PluginScanner, PluginContainer };
