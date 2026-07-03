const path = require('path');
const fs = require('fs');

class ConfigLoader {
  constructor(options = {}) {
    this.configDir = options.configDir || path.resolve(process.cwd(), 'config');
    this.cache = new Map();
    this.environment = process.env.NODE_ENV || 'development';
  }

  load(name) {
    if (this.cache.has(name)) return this.cache.get(name);

    const basePath = path.join(this.configDir, `${name}.json`);
    const envPath = path.join(this.configDir, `${this.environment}.json`);

    let config = {};

    if (fs.existsSync(basePath)) {
      config = JSON.parse(fs.readFileSync(basePath, 'utf-8'));
    }

    if (fs.existsSync(envPath)) {
      const envConfig = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
      config = this._merge(config, envConfig);
    }

    this.cache.set(name, config);
    return config;
  }

  get(key, defaultValue) {
    const parts = key.split('.');
    let appConfig = this.cache.get('default');
    if (!appConfig) {
      appConfig = this.load('default');
    }
    let value = appConfig;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue;
      }
    }
    return value !== undefined ? value : defaultValue;
  }

  _merge(base, override) {
    const result = { ...base };
    for (const key of Object.keys(override)) {
      if (typeof override[key] === 'object' && !Array.isArray(override[key]) && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = this._merge(result[key], override[key]);
      } else {
        result[key] = override[key];
      }
    }
    return result;
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = ConfigLoader;
