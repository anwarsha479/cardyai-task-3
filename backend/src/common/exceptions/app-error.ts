export enum ErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RULE_VIOLATION = 'RULE_VIOLATION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export enum RuleReason {
  EVENT_CLOSED = 'EVENT_CLOSED',
  SEATS_IN_USE = 'SEATS_IN_USE',
  SEAT_LIMIT_EXCEEDED = 'SEAT_LIMIT_EXCEEDED',
  SEAT_UNAVAILABLE = 'SEAT_UNAVAILABLE',
  HOLD_EXISTS = 'HOLD_EXISTS',
  HOLD_EXPIRED = 'HOLD_EXPIRED',
  INVALID_STATE = 'INVALID_STATE',
}

export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.RULE_VIOLATION]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly reason?: RuleReason,
  ) {
    super(message);
  }

  get status(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }

  static unauthenticated(message = 'Sign in required'): AppError {
    return new AppError(ErrorCode.UNAUTHENTICATED, message);
  }

  static forbidden(message: string): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message);
  }

  static notFound(itemName: string): AppError {
    return new AppError(ErrorCode.NOT_FOUND, `${itemName} not found`);
  }

  static validation(fields: FieldErrors, message?: string): AppError {
    const summary = message ?? Object.values(fields).flat()[0] ?? 'Invalid input';
    return new AppError(ErrorCode.VALIDATION_ERROR, summary, { fields });
  }

  static rule(reason: RuleReason, message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.RULE_VIOLATION, message, details, reason);
  }
}
