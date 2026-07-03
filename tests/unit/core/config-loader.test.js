const path = require('path');
const fs = require('fs');
const ConfigLoader = require('../../../src/core/config-loader');

describe('ConfigLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new ConfigLoader({ configDir: path.resolve(process.cwd(), 'config') });
  });

  afterEach(() => {
    loader.clearCache();
  });

  describe('load', () => {
    it('should load default config', () => {
      const config = loader.load('default');
      expect(config).toBeDefined();
      expect(config.app).toBeDefined();
      expect(config.app.name).toBe('toolkit');
      expect(config.app.version).toBe('4.0.0');
    });

    it('should load permissions config', () => {
      const config = loader.load('permissions');
      expect(config).toBeDefined();
      expect(config.roles).toBeDefined();
      expect(config.roles.admin).toEqual(['*']);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      loader.load('default');
    });

    it('should return value for nested key', () => {
      expect(loader.get('server.port')).toBe(6969);
    });

    it('should return default for missing key', () => {
      expect(loader.get('nonexistent.key', 'fallback')).toBe('fallback');
    });

    it('should return undefined for missing key without default', () => {
      expect(loader.get('nonexistent.key')).toBeUndefined();
    });
  });

  describe('environment override', () => {
    beforeEach(() => {
      const envPath = path.resolve(process.cwd(), 'config', 'production.json');
      if (!fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, JSON.stringify({ server: { port: 8080 } }));
      }
    });

    afterEach(() => {
      const envPath = path.resolve(process.cwd(), 'config', 'production.json');
      if (fs.existsSync(envPath)) {
        fs.unlinkSync(envPath);
      }
    });

    it('should merge environment config', () => {
      process.env.NODE_ENV = 'production';
      const testLoader = new ConfigLoader({ configDir: path.resolve(process.cwd(), 'config') });
      const config = testLoader.load('default');
      expect(config.server.port).toBe(8080);
      expect(config.app.name).toBe('toolkit');
      delete process.env.NODE_ENV;
    });
  });
});
