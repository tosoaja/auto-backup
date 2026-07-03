const path = require('path');
const ConfigLoader = require('./core/config-loader');
const Logger = require('./core/logger');
const EventBus = require('./core/event-bus');
const { CommandRegistry } = require('./core/command-registry');
const { PluginEngine } = require('./core/plugin-engine');

class AppLoader {
  constructor() {
    this.config = null;
    this.logger = null;
    this.eventBus = null;
    this.registry = null;
    this.pluginEngine = null;
    this._initialized = false;
  }

  async initialize() {
    const configLoader = new ConfigLoader();
    this.config = configLoader.load('default');

    this.eventBus = new EventBus();

    this.logger = new Logger(this.config.logging);

    this.logger.info('App initialized', {
      name: this.config.app.name,
      version: this.config.app.version,
      environment: process.env.NODE_ENV || 'development'
    });

    this.registry = new CommandRegistry();

    const scanDirs = [
      path.resolve(process.cwd(), 'src', 'modules')
    ];

    this.pluginEngine = new PluginEngine({
      registry: this.registry,
      logger: this.logger,
      eventBus: this.eventBus,
      appConfig: this.config,
      scanDirectories: scanDirs
    });

    const pluginCount = await this.pluginEngine.initialize();

    this.logger.info(`Plugin engine ready: ${pluginCount} plugin(s), ${this.registry.list().length} command(s)`);

    this.eventBus.emit('app.initialized', {
      name: this.config.app.name,
      version: this.config.app.version,
      plugins: pluginCount,
      commands: this.registry.list().length
    });

    this._initialized = true;
    return this;
  }

  getConfig(key, defaultValue) {
    const parts = key.split('.');
    let value = this.config;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue;
      }
    }
    return value !== undefined ? value : defaultValue;
  }

  isInitialized() {
    return this._initialized;
  }
}

module.exports = AppLoader;
