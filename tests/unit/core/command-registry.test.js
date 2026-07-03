const { CommandRegistry, CommandNotFoundError, CommandExecutionError } = require('../../../src/core/command-registry');

describe('CommandRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('register', () => {
    it('should register command with module prefix', () => {
      registry.register('test', {
        name: 'ping',
        handler: jest.fn()
      });
      expect(registry.find('test.ping')).toBeDefined();
    });

    it('should register short alias if no conflict', () => {
      registry.register('test', { name: 'ping', handler: jest.fn() });
      expect(registry.find('ping')).toBeDefined();
    });

    it('should throw on duplicate command', () => {
      registry.register('test', { name: 'ping', handler: jest.fn() });
      expect(() => {
        registry.register('test', { name: 'ping', handler: jest.fn() });
      }).toThrow('already registered');
    });

    it('should not overwrite existing alias on conflict', () => {
      registry.register('a', { name: 'cmd', handler: jest.fn() });
      registry.register('b', { name: 'cmd', handler: jest.fn() });
      const found = registry.find('cmd');
      expect(found.moduleName).toBe('a');
    });
  });

  describe('unregister', () => {
    it('should remove a command', () => {
      registry.register('test', { name: 'ping', handler: jest.fn() });
      expect(registry.unregister('test', 'ping')).toBe(true);
      expect(registry.find('test.ping')).toBeNull();
    });

    it('should unregister all commands for a module', () => {
      registry.register('test', { name: 'a', handler: jest.fn() });
      registry.register('test', { name: 'b', handler: jest.fn() });
      expect(registry.unregisterModule('test')).toBe(true);
      expect(registry.find('test.a')).toBeNull();
      expect(registry.find('test.b')).toBeNull();
    });
  });

  describe('find', () => {
    it('should find by full key', () => {
      registry.register('test', { name: 'ping', handler: jest.fn() });
      expect(registry.find('test.ping')).toBeDefined();
    });

    it('should find by alias', () => {
      registry.register('test', { name: 'ping', handler: jest.fn() });
      expect(registry.find('ping')).toBeDefined();
    });

    it('should return null for unknown command', () => {
      expect(registry.find('nope')).toBeNull();
    });
  });

  describe('execute', () => {
    it('should call handler with context', async () => {
      const handler = jest.fn().mockReturnValue('ok');
      registry.register('test', { name: 'ping', handler });

      const result = await registry.execute('test.ping', { data: 1 });
      expect(handler).toHaveBeenCalledWith({ data: 1 });
      expect(result.success).toBe(true);
      expect(result.data).toBe('ok');
    });

    it('should reject unknown command', async () => {
      await expect(registry.execute('nope', {})).rejects.toThrow(CommandNotFoundError);
    });

    it('should enforce timeout for async commands', async () => {
      const handler = jest.fn().mockImplementation(() => new Promise(() => {}));
      registry.register('test', {
        name: 'slow',
        handler,
        async: true,
        timeout: 50
      });

      await expect(registry.execute('test.slow', {})).rejects.toThrow(/timed out/i);
    });

    it('should check permission if provided', async () => {
      const handler = jest.fn().mockReturnValue('ok');
      registry.register('test', { name: 'secret', handler, permission: 'admin' });

      const permissions = {
        check: jest.fn().mockRejectedValue(new Error('Forbidden'))
      };

      await expect(registry.execute('test.secret', { permissions })).rejects.toThrow(CommandExecutionError);
      expect(permissions.check).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should list all commands', () => {
      registry.register('a', { name: 'x', handler: jest.fn() });
      registry.register('b', { name: 'y', handler: jest.fn() });
      expect(registry.list().length).toBe(2);
    });

    it('should list by category', () => {
      registry.register('cat1', { name: 'a', handler: jest.fn() });
      registry.register('cat1', { name: 'b', handler: jest.fn() });
      registry.register('cat2', { name: 'c', handler: jest.fn() });

      const byCat = registry.listByCategory();
      expect(Object.keys(byCat)).toEqual(['cat1', 'cat2']);
      expect(byCat.cat1.length).toBe(2);
      expect(byCat.cat2.length).toBe(1);
    });
  });
});
