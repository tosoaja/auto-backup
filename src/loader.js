const ConfigLoader = require('./core/config-loader');
const Logger = require('./core/logger');
const EventBus = require('./core/event-bus');

class AppLoader {
  constructor() {
    this.config = null;
    this.logger = null;
    this.eventBus = null;
    this.modules = new Map();
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

    this.eventBus.emit('app.initialized', {
      name: this.config.app.name,
      version: this.config.app.version
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
