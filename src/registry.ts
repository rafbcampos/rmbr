import { createRegistry, type ModuleRegistry } from './core/registry.ts';
import { todoModule } from './modules/todo/index.ts';
import { kudosModule } from './modules/kudos/index.ts';
import { goalsModule } from './modules/goals/index.ts';
import { tilModule } from './modules/til/index.ts';
import { studyModule } from './modules/study/index.ts';
import { slackModule } from './modules/slack/index.ts';
import { tagsModule } from './modules/tags/index.ts';
import { searchModule } from './modules/search/index.ts';

export function createAppRegistry(): ModuleRegistry {
  const registry = createRegistry();

  registry.register(todoModule);
  registry.register(kudosModule);
  registry.register(goalsModule);
  registry.register(tilModule);
  registry.register(studyModule);
  registry.register(slackModule);
  registry.register(tagsModule);
  registry.register(searchModule);

  return registry;
}
