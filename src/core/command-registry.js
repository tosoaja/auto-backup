class CommandNotFoundError extends Error {
  constructor(name) {
    super(`Command not found: ${name}`);
    this.name = 'CommandNotFoundError';
    this.code = 'COMMAND_NOT_FOUND';
  }
}

class CommandTimeoutError extends Error {
  constructor(name, timeout) {
    super(`Command timed out after ${timeout}ms: ${name}`);
    this.name = 'CommandTimeoutError';
    this.code = 'COMMAND_TIMEOUT';
  }
}

class CommandExecutionError extends Error {
  constructor(name, cause) {
    super(`Command failed: ${name} - ${cause.message}`);
    this.name = 'CommandExecutionError';
    this.code = 'COMMAND_ERROR';
    this.cause = cause;
  }
}

class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
    this.categories = new Map();
  }

  register(moduleName, commandDef) {
    if (!moduleName || !commandDef || !commandDef.name) {
      throw new Error('Invalid command definition: moduleName and commandDef.name are required');
    }

    const key = `${moduleName}.${commandDef.name}`;

    if (this.commands.has(key)) {
      throw new Error(`Command already registered: ${key}`);
    }

    const entry = {
      key,
      moduleName,
      name: commandDef.name,
      description: commandDef.description || '',
      handler: commandDef.handler,
      async: commandDef.async !== false,
      timeout: commandDef.timeout || 30000,
      permission: commandDef.permission || null,
      input: commandDef.input || 'none',
      category: moduleName
    };

    this.commands.set(key, entry);

    if (!this.aliases.has(commandDef.name)) {
      this.aliases.set(commandDef.name, key);
    }

    if (!this.categories.has(moduleName)) {
      this.categories.set(moduleName, []);
    }
    this.categories.get(moduleName).push(entry);

    return this;
  }

  unregister(moduleName, commandName) {
    const key = `${moduleName}.${commandName}`;
    const entry = this.commands.get(key);
    if (!entry) return false;

    this.commands.delete(key);

    if (this.aliases.get(commandName) === key) {
      this.aliases.delete(commandName);
    }

    const cat = this.categories.get(moduleName);
    if (cat) {
      const idx = cat.indexOf(entry);
      if (idx !== -1) cat.splice(idx, 1);
      if (cat.length === 0) this.categories.delete(moduleName);
    }

    return true;
  }

  unregisterModule(moduleName) {
    const cat = this.categories.get(moduleName);
    if (!cat) return false;
    const names = [...cat];
    for (const entry of names) {
      this.unregister(moduleName, entry.name);
    }
    return true;
  }

  find(input) {
    if (this.commands.has(input)) {
      return this.commands.get(input);
    }

    const alias = this.aliases.get(input);
    if (alias) {
      return this.commands.get(alias);
    }

    return null;
  }

  findCategory(moduleName) {
    return this.categories.get(moduleName) || [];
  }

  list() {
    return Array.from(this.commands.values());
  }

  listByCategory() {
    const result = {};
    for (const [category, commands] of this.categories) {
      result[category] = commands.map(c => ({
        name: c.name,
        key: c.key,
        description: c.description,
        async: c.async,
        permission: c.permission
      }));
    }
    return result;
  }

  async execute(commandKey, context = {}) {
    const command = this.find(commandKey);
    if (!command) {
      throw new CommandNotFoundError(commandKey);
    }

    if (context.permissions && command.permission) {
      try {
        await context.permissions.check(context.user || {}, command.permission);
      } catch (err) {
        throw new CommandExecutionError(commandKey, err);
      }
    }

    const startTime = Date.now();

    try {
      let result;

      if (command.async) {
        result = await Promise.race([
          command.handler(context),
          new Promise((_, reject) =>
            setTimeout(() => reject(new CommandTimeoutError(commandKey, command.timeout)), command.timeout)
          )
        ]);
      } else {
        result = command.handler(context);
      }

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
        command: commandKey
      };
    } catch (err) {
      if (err instanceof CommandTimeoutError || err instanceof CommandExecutionError) {
        throw err;
      }
      throw new CommandExecutionError(commandKey, err);
    }
  }
}

module.exports = {
  CommandRegistry,
  CommandNotFoundError,
  CommandTimeoutError,
  CommandExecutionError
};
