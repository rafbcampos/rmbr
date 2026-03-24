import { describe, it, expect } from 'bun:test';
import { KEY } from '../../../../src/modules/til/tui/keys.ts';

describe('til tui keys', () => {
  describe('KEY', () => {
    it('has unique values for all keys', () => {
      const values = Object.values(KEY);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('includes QUIT key', () => {
      expect(KEY.QUIT).toBe('q');
    });

    it('includes DOMAIN_CYCLE key', () => {
      expect(KEY.DOMAIN_CYCLE).toBe('d');
    });
  });
});
