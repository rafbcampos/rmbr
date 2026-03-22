import { describe, it, expect } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { loadConfig, getDefaultDataDir } from '../../src/core/config.ts';

describe('config', () => {
  it('should return default data dir under home', () => {
    const dir = getDefaultDataDir();
    expect(dir).toContain('.rmbr');
  });

  it('should create data directory if it does not exist', () => {
    const testDir = join(tmpdir(), `rmbr-test-${Date.now()}`);
    try {
      const config = loadConfig(testDir);
      expect(existsSync(testDir)).toBe(true);
      expect(config.dataDir).toBe(testDir);
      expect(config.dbPath).toBe(join(testDir, 'rmbr.db'));
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should use existing directory without error', () => {
    const testDir = join(tmpdir(), `rmbr-test-${Date.now()}`);
    try {
      loadConfig(testDir);
      const config = loadConfig(testDir);
      expect(config.dataDir).toBe(testDir);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
