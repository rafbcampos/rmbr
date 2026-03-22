import type { Migration } from './migrator.ts';
import type { McpToolDefinition, RmbrModule } from './module-contract.ts';

export interface ModuleRegistry {
  register(mod: RmbrModule): void;
  getModules(): readonly RmbrModule[];
  getModule(name: string): RmbrModule | undefined;
  getAllMigrations(): readonly Migration[];
  getAllTools(): readonly McpToolDefinition[];
}

export function createRegistry(): ModuleRegistry {
  const modules = new Map<string, RmbrModule>();

  return {
    register(mod: RmbrModule): void {
      if (modules.has(mod.name)) {
        throw new Error(`Module '${mod.name}' is already registered`);
      }
      modules.set(mod.name, mod);
    },

    getModules(): readonly RmbrModule[] {
      return [...modules.values()];
    },

    getModule(name: string): RmbrModule | undefined {
      return modules.get(name);
    },

    getAllMigrations(): readonly Migration[] {
      return [...modules.values()].flatMap(m => m.migrations);
    },

    getAllTools(): readonly McpToolDefinition[] {
      return [...modules.values()].flatMap(m => m.tools);
    },
  };
}
