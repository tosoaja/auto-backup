const path = require('path');
const fs = require('fs');
const os = require('os');
const { CommandRegistry } = require('../../../src/core/command-registry');
const { PluginEngine, PluginScanner, PluginContainer } = require('../../../src/core/plugin-engine');

describe('PluginScanner', () => {
  const testDir = path.join(os.tmpdir(), 'plugin-scanner-test-' + Date.now());
  const moduleDir = path.join(testDir, 'testmod');

  beforeAll(() => {
    fs.mkdirSync(moduleDir, { recursive: true });
    fs.writeFileSync(path.join(moduleDir, 'module.json'), JSON.stringify({
      name: 'testmod',
      version: '1.0.0',
      commands: []
    }));
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should find module with module.json', async () => {
    const scanner = new PluginScanner();
    const manifests = await scanner.scan([testDir]);
    expect(manifests.length).toBe(1);
    expect(manifests[0]._name).toBe('testmod');
    expect(manifests[0].name).toBe('testmod');
  });

  it('should skip directories without module.json', async () => {
    const emptyDir = path.join(testDir, 'empty');
    fs.mkdirSync(emptyDir);
    const scanner = new PluginScanner();
    const manifests = await scanner.scan([testDir]);
    expect(manifests.length).toBe(1);
  });
});

describe('PluginContainer', () => {
  let container;

  beforeEach(() => {
    container = new PluginContainer({
      _name: 'testmod',
      _path: '/tmp',
      name: 'testmod',
      version: '1.0.0',
      commands: [{ name: 'ping', handler: 'does-not-exist.js' }]
    });
  });

  it('should start as registered', () => {
    expect(container.status).toBe('registered');
  });

  it('should validate manifest', async () => {
    await expect(container.validate()).resolves.toBe(true);
    expect(container.status).toBe('validated');
  });

  it('should fail validation without commands', async () => {
    const bad = new PluginContainer({ _name: 'bad', _path: '/tmp', name: 'bad' });
    await expect(bad.validate()).rejects.toThrow('commands array required');
  });

  it('should resolve dependencies', async () => {
    const loaded = new Map();
    loaded.set('dep1', {});
    container.manifest.dependencies = { dep1: '1.0.0' };
    await expect(container.resolveDependencies(loaded)).resolves.toBe(true);
  });

  it('should fail on missing dependencies', async () => {
    container.manifest.dependencies = { missing: '1.0.0' };
    await expect(container.resolveDependencies(new Map())).rejects.toThrow('missing');
  });

  it('should track command names', () => {
    container.commands = ['ping', 'pong'];
    expect(container.getCommandNames()).toEqual(['ping', 'pong']);
  });
});

describe('PluginEngine', () => {
  let engine;
  let registry;

  const testModuleDir = path.resolve(process.cwd(), 'src', 'modules');

  beforeEach(() => {
    registry = new CommandRegistry();
    engine = new PluginEngine({
      registry,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      scanDirectories: [testModuleDir]
    });
  });

  it('should load plugins from src/modules', async () => {
    const count = await engine.initialize();
    expect(count).toBeGreaterThanOrEqual(3); // forensic, crypto, encoder
  });

  it('should register commands from loaded plugins', async () => {
    await engine.initialize();
    const commands = registry.list();
    expect(commands.length).toBeGreaterThan(20);

    const forensic = registry.find('forensic.metadata');
    expect(forensic).toBeDefined();
    expect(forensic.moduleName).toBe('forensic');

    const crypto = registry.find('crypto.base64');
    expect(crypto).toBeDefined();

    const encoder = registry.find('encoder.encode');
    expect(encoder).toBeDefined();
  });

  it('should execute forensic commands through registry', async () => {
    await engine.initialize();
    const handler = registry.find('forensic.entropy');
    expect(handler).toBeDefined();
  });

  it('should list loaded plugins', async () => {
    await engine.initialize();
    const list = engine.list();
    const names = list.map(p => p.name);
    expect(names).toContain('forensic');
    expect(names).toContain('crypto');
    expect(names).toContain('encoder');
  });

  it('should unload a plugin', async () => {
    await engine.initialize();
    expect(engine.isLoaded('crypto')).toBe(true);

    await engine.unload('crypto');
    expect(engine.isLoaded('crypto')).toBe(false);
    expect(registry.find('crypto.base64')).toBeNull();
  });
});
