const path = require('path');
const ConfigLoader = require('./core/config-loader');
const Logger = require('./core/logger');
const EventBus = require('./core/event-bus');
const { CommandRegistry } = require('./core/command-registry');
const { PluginEngine } = require('./core/plugin-engine');
const { TaskQueue } = require('./core/task-queue');
const { PermissionManager } = require('./core/permission-manager');

class AppLoader {
  constructor() {
    this.config = null;
    this.logger = null;
    this.eventBus = null;
    this.registry = null;
    this.pluginEngine = null;
    this.taskQueue = null;
    this.permissions = null;
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

    const permConfig = configLoader.load('permissions');
    this.permissions = new PermissionManager({
      roles: permConfig.roles || {},
      permissions: permConfig.permissions || {},
      defaultRole: permConfig.defaultRole || 'guest'
    });

    this.logger.info('Permission manager ready', {
      roles: this.permissions.roleNames()
    });

    this.taskQueue = new TaskQueue({
      concurrency: this.config.taskQueue.concurrency || 3,
      defaultTimeout: this.config.taskQueue.defaultTimeout || 300000
    });

    this.taskQueue.on('task:completed', ({ id, type, result, duration }) => {
      this.logger.info(`Task completed: ${type}`, { taskId: id, duration });
    });

    this.taskQueue.on('task:failed', ({ id, type, error }) => {
      this.logger.error(`Task failed: ${type}`, { taskId: id, error });
    });

    this.taskQueue.on('task:progress', ({ id, type, progress }) => {
      this.eventBus.emit('task.progress', { taskId: id, type, progress });
    });

    this.logger.info('Task queue ready', {
      concurrency: this.config.taskQueue.concurrency
    });

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
