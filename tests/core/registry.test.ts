import { describe, it, expect } from 'bun:test';
import { createRegistry } from '../../src/core/registry.ts';
import type { RmbrModule } from '../../src/core/module-contract.ts';

function createMockModule(name: string): RmbrModule {
  return {
    name,
    migrations: [{ version: 1, description: 'test', up: '', down: '' }],
    tools: [
      {
        name: `rmbr_${name}_list`,
        description: 'List items',
        schema: {},
        handler: async () => ({ items: [] }),
      },
    ],
    registerCommands: () => {},
  };
}

describe('registry', () => {
  it('should register and retrieve a module', () => {
    const registry = createRegistry();
    const mod = createMockModule('test');
    registry.register(mod);
    expect(registry.getModule('test')).toBe(mod);
  });

  it('should throw on duplicate module registration', () => {
    const registry = createRegistry();
    const mod = createMockModule('test');
    registry.register(mod);
    expect(() => registry.register(mod)).toThrow("Module 'test' is already registered");
  });

  it('should return undefined for unknown module', () => {
    const registry = createRegistry();
    expect(registry.getModule('unknown')).toBeUndefined();
  });

  it('should return all registered modules', () => {
    const registry = createRegistry();
    registry.register(createMockModule('a'));
    registry.register(createMockModule('b'));
    expect(registry.getModules()).toHaveLength(2);
  });

  it('should aggregate all migrations', () => {
    const registry = createRegistry();
    registry.register(createMockModule('a'));
    registry.register(createMockModule('b'));
    expect(registry.getAllMigrations()).toHaveLength(2);
  });

  it('should aggregate all tools', () => {
    const registry = createRegistry();
    registry.register(createMockModule('a'));
    registry.register(createMockModule('b'));
    expect(registry.getAllTools()).toHaveLength(2);
  });

  it('should throw on duplicate tool names across modules', () => {
    const registry = createRegistry();
    const mod1: RmbrModule = {
      name: 'mod1',
      migrations: [],
      tools: [
        {
          name: 'rmbr_shared_tool',
          description: 'Tool 1',
          schema: {},
          handler: async () => ({}),
        },
      ],
      registerCommands: () => {},
    };
    const mod2: RmbrModule = {
      name: 'mod2',
      migrations: [],
      tools: [
        {
          name: 'rmbr_shared_tool',
          description: 'Tool 2',
          schema: {},
          handler: async () => ({}),
        },
      ],
      registerCommands: () => {},
    };
    registry.register(mod1);
    registry.register(mod2);
    expect(() => registry.getAllTools()).toThrow("Duplicate tool name: 'rmbr_shared_tool'");
  });
});
