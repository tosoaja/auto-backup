const { PermissionManager, PermissionError, Role, PermissionRule } = require('../../../src/core/permission-manager');

describe('PermissionRule', () => {
  it('should match exact permission', () => {
    const rule = new PermissionRule('forensic.read');
    expect(rule.matches('forensic.read')).toBe(true);
    expect(rule.matches('forensic.write')).toBe(false);
  });

  it('should match wildcard', () => {
    const rule = new PermissionRule('forensic.*');
    expect(rule.matches('forensic.read')).toBe(true);
    expect(rule.matches('forensic.write')).toBe(true);
    expect(rule.matches('crypto.read')).toBe(false);
  });

  it('should match global wildcard', () => {
    const rule = new PermissionRule('*');
    expect(rule.matches('anything.at.all')).toBe(true);
  });

  it('should match multi-level wildcard', () => {
    const rule = new PermissionRule('*.read');
    expect(rule.matches('forensic.read')).toBe(true);
    expect(rule.matches('crypto.read')).toBe(true);
    expect(rule.matches('forensic.write')).toBe(false);
  });
});

describe('Role', () => {
  it('should check permissions', () => {
    const role = new Role('admin', ['*']);
    expect(role.hasPermission('anything')).toBe(true);
  });

  it('should check scoped permissions', () => {
    const role = new Role('analyst', ['forensic.*', 'crypto.read']);
    expect(role.hasPermission('forensic.read')).toBe(true);
    expect(role.hasPermission('forensic.write')).toBe(true);
    expect(role.hasPermission('crypto.read')).toBe(true);
    expect(role.hasPermission('crypto.write')).toBe(false);
    expect(role.hasPermission('nmap.scan')).toBe(false);
  });

  it('should serialize to JSON', () => {
    const role = new Role('test', ['a.b', 'c.d']);
    const json = role.toJSON();
    expect(json.name).toBe('test');
    expect(json.rules).toEqual(['a.b', 'c.d']);
  });
});

describe('PermissionManager', () => {
  let pm;

  beforeEach(() => {
    pm = new PermissionManager({
      roles: {
        admin: ['*'],
        user: ['forensic.*', 'crypto.read', 'encoder.*'],
        guest: ['crypto.read', 'encoder.encode']
      },
      defaultRole: 'guest'
    });
  });

  describe('getUserRole', () => {
    it('should return user role', () => {
      expect(pm.getUserRole({ role: 'admin' })).toBe('admin');
    });

    it('should return default for missing role', () => {
      expect(pm.getUserRole({})).toBe('guest');
    });

    it('should return default for null user', () => {
      expect(pm.getUserRole(null)).toBe('guest');
    });
  });

  describe('check', () => {
    it('should allow admin access to anything', async () => {
      await expect(pm.check({ role: 'admin' }, 'secret.admin.only')).resolves.toBe(true);
    });

    it('should allow user access to permitted resources', async () => {
      await expect(pm.check({ role: 'user' }, 'forensic.read')).resolves.toBe(true);
      await expect(pm.check({ role: 'user' }, 'forensic.write')).resolves.toBe(true);
    });

    it('should deny user access to forbidden resources', async () => {
      await expect(pm.check({ role: 'user' }, 'admin.only')).rejects.toThrow(PermissionError);
    });

    it('should allow guest access to public resources', async () => {
      await expect(pm.check({ role: 'guest' }, 'crypto.read')).resolves.toBe(true);
      await expect(pm.check({ role: 'guest' }, 'encoder.encode')).resolves.toBe(true);
    });

    it('should deny guest access to protected resources', async () => {
      await expect(pm.check({ role: 'guest' }, 'forensic.write')).rejects.toThrow(PermissionError);
    });

    it('should skip check if no permission required', async () => {
      await expect(pm.check({ role: 'guest' }, null)).resolves.toBe(true);
      await expect(pm.check({ role: 'guest' }, '')).resolves.toBe(true);
    });
  });

  describe('can', () => {
    it('should return boolean', () => {
      expect(pm.can({ role: 'admin' }, 'anything')).toBe(true);
      expect(pm.can({ role: 'guest' }, 'forensic.write')).toBe(false);
    });
  });

  describe('listRoles', () => {
    it('should list all defined roles', () => {
      const roles = pm.listRoles();
      expect(roles.length).toBe(3);
      const names = roles.map(r => r.name);
      expect(names).toContain('admin');
      expect(names).toContain('user');
      expect(names).toContain('guest');
    });
  });

  describe('constructor', () => {
    it('should work with minimal options', () => {
      const pm2 = new PermissionManager();
      expect(pm2.roleNames()).toEqual([]);
      expect(pm2.getUserRole({})).toBe('guest');
    });

    it('should define roles from constructor', () => {
      const pm2 = new PermissionManager({
        roles: { custom: ['x.y'] }
      });
      expect(pm2.roleNames()).toContain('custom');
    });
  });

  describe('socketMiddleware', () => {
    it('should return a middleware function', () => {
      const middleware = pm.socketMiddleware('forensic.read');
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(2); // (socket, next)
    });

    it('should call next() on allowed access', (done) => {
      const middleware = pm.socketMiddleware('forensic.read');
      const socket = { user: { role: 'admin' } };
      middleware(socket, (err) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    it('should call next(err) on denied access', (done) => {
      const middleware = pm.socketMiddleware('admin.only');
      const socket = { user: { role: 'guest' } };
      middleware(socket, (err) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('Permission denied');
        done();
      });
    });
  });

  describe('middleware', () => {
    it('should return Express middleware', () => {
      const mw = pm.middleware('test');
      expect(typeof mw).toBe('function');
      expect(mw.length).toBe(3); // (req, res, next)
    });
  });
});
