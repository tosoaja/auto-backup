class PermissionError extends Error {
  constructor(permission, role) {
    super(`Permission denied: ${permission} (role: ${role})`);
    this.name = 'PermissionError';
    this.code = 'PERMISSION_DENIED';
    this.permission = permission;
    this.role = role;
  }
}

class PermissionRule {
  constructor(pattern) {
    this.pattern = pattern;
    this.regex = new RegExp(
      '^' + pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') + '$'
    );
  }

  matches(permission) {
    return this.regex.test(permission);
  }
}

class Role {
  constructor(name, rules) {
    this.name = name;
    this.rules = (rules || []).map(r => new PermissionRule(r));
  }

  hasPermission(permission) {
    return this.rules.some(rule => rule.matches(permission));
  }

  toJSON() {
    return {
      name: this.name,
      rules: this.rules.map(r => r.pattern)
    };
  }
}

class PermissionManager {
  constructor(options = {}) {
    this.roles = new Map();
    this.defaultRole = options.defaultRole || 'guest';
    this._meta = new Map();

    if (options.roles) {
      for (const [name, rules] of Object.entries(options.roles)) {
        this.defineRole(name, rules);
      }
    }

    if (options.permissions) {
      for (const [name, meta] of Object.entries(options.permissions)) {
        this._meta.set(name, meta);
      }
    }
  }

  defineRole(name, permissions) {
    if (typeof permissions === 'string') {
      permissions = [permissions];
    }
    this.roles.set(name, new Role(name, permissions));
    return this;
  }

  getUserRole(user) {
    if (!user || !user.role) return this.defaultRole;
    const roleName = user.role;
    if (this.roles.has(roleName)) return roleName;
    return this.defaultRole;
  }

  async check(user, requiredPermission) {
    if (!requiredPermission) return true;

    const roleName = this.getUserRole(user);
    const role = this.roles.get(roleName);
    if (!role) {
      throw new PermissionError(requiredPermission, roleName);
    }

    if (role.hasPermission(requiredPermission)) {
      return true;
    }

    throw new PermissionError(requiredPermission, roleName);
  }

  can(user, permission) {
    const roleName = this.getUserRole(user);
    const role = this.roles.get(roleName);
    if (!role) return false;
    return role.hasPermission(permission);
  }

  middleware(requiredPermission) {
    return (req, res, next) => {
      try {
        this.check(req.user || {}, requiredPermission);
        next();
      } catch (err) {
        if (err instanceof PermissionError) {
          res.status(403).json({
            error: 'Forbidden',
            permission: requiredPermission,
            message: err.message
          });
        } else {
          next(err);
        }
      }
    };
  }

  socketMiddleware(requiredPermission) {
    return (socket, next) => {
      this.check(socket.user || {}, requiredPermission)
        .then(() => next())
        .catch(err => next(new Error(err.message)));
    };
  }

  listRoles() {
    return Array.from(this.roles.entries()).map(([name, role]) => role.toJSON());
  }

  roleNames() {
    return Array.from(this.roles.keys());
  }

  describePermission(permission) {
    return this._meta.get(permission) || null;
  }
}

module.exports = { PermissionManager, PermissionError, Role, PermissionRule };
