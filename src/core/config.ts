import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface RmbrConfig {
  readonly dataDir: string;
  readonly dbPath: string;
}

export function getDefaultDataDir(): string {
  return join(homedir(), '.rmbr');
}

export function loadConfig(dataDir?: string): RmbrConfig {
  const dir = dataDir ?? getDefaultDataDir();

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return {
    dataDir: dir,
    dbPath: join(dir, 'rmbr.db'),
  };
}
