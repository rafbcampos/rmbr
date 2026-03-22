export class RmbrError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'RmbrError';
  }
}

export class NotFoundError extends RmbrError {
  constructor(entity: string, id: number | string) {
    super(`${entity} with id ${id} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class InvalidTransitionError extends RmbrError {
  constructor(entity: string, from: string, to: string) {
    super(`Invalid ${entity} transition from '${from}' to '${to}'`, 'INVALID_TRANSITION');
    this.name = 'InvalidTransitionError';
  }
}

export class ValidationError extends RmbrError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends RmbrError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}
