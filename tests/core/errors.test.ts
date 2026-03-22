import { describe, it, expect } from 'bun:test';
import {
  RmbrError,
  NotFoundError,
  InvalidTransitionError,
  ValidationError,
  DatabaseError,
} from '../../src/core/errors.ts';

describe('errors', () => {
  describe('RmbrError', () => {
    it('should set message and code', () => {
      const error = new RmbrError('something broke', 'CUSTOM_CODE');
      expect(error.message).toBe('something broke');
      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should be an instance of Error', () => {
      const error = new RmbrError('fail', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have name set to RmbrError', () => {
      const error = new RmbrError('fail', 'CODE');
      expect(error.name).toBe('RmbrError');
    });
  });

  describe('NotFoundError', () => {
    it('should format message with entity and id', () => {
      const error = new NotFoundError('Todo', 42);
      expect(error.message).toBe('Todo with id 42 not found');
    });

    it('should accept string ids', () => {
      const error = new NotFoundError('Goal', 'abc-123');
      expect(error.message).toBe('Goal with id abc-123 not found');
    });

    it('should have code NOT_FOUND', () => {
      const error = new NotFoundError('Todo', 1);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should have name set to NotFoundError', () => {
      const error = new NotFoundError('Todo', 1);
      expect(error.name).toBe('NotFoundError');
    });

    it('should be an instance of RmbrError and Error', () => {
      const error = new NotFoundError('Todo', 1);
      expect(error).toBeInstanceOf(RmbrError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('InvalidTransitionError', () => {
    it('should format message with entity, from, and to', () => {
      const error = new InvalidTransitionError('todo', 'open', 'done');
      expect(error.message).toBe("Invalid todo transition from 'open' to 'done'");
    });

    it('should have code INVALID_TRANSITION', () => {
      const error = new InvalidTransitionError('goal', 'draft', 'archived');
      expect(error.code).toBe('INVALID_TRANSITION');
    });

    it('should have name set to InvalidTransitionError', () => {
      const error = new InvalidTransitionError('todo', 'open', 'done');
      expect(error.name).toBe('InvalidTransitionError');
    });

    it('should be an instance of RmbrError and Error', () => {
      const error = new InvalidTransitionError('todo', 'open', 'done');
      expect(error).toBeInstanceOf(RmbrError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should set message', () => {
      const error = new ValidationError('title is required');
      expect(error.message).toBe('title is required');
    });

    it('should have code VALIDATION_ERROR', () => {
      const error = new ValidationError('invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should have name set to ValidationError', () => {
      const error = new ValidationError('bad data');
      expect(error.name).toBe('ValidationError');
    });

    it('should be an instance of RmbrError and Error', () => {
      const error = new ValidationError('bad data');
      expect(error).toBeInstanceOf(RmbrError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('DatabaseError', () => {
    it('should set message', () => {
      const error = new DatabaseError('connection failed');
      expect(error.message).toBe('connection failed');
    });

    it('should have code DATABASE_ERROR', () => {
      const error = new DatabaseError('disk full');
      expect(error.code).toBe('DATABASE_ERROR');
    });

    it('should have name set to DatabaseError', () => {
      const error = new DatabaseError('timeout');
      expect(error.name).toBe('DatabaseError');
    });

    it('should be an instance of RmbrError and Error', () => {
      const error = new DatabaseError('timeout');
      expect(error).toBeInstanceOf(RmbrError);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
