import { logger } from "@/lib/logger";

/**
 * Consistent, safe error handling.
 *
 * Customers and admin users see a short sentence. Stack traces, Prisma error
 * codes, SQL, file paths and environment values stay on the server.
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYMENT"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT: 402,
  INTERNAL: 500,
};

/** Wording that is safe to show to anyone. */
const SAFE_MESSAGE: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "We could not find what you were looking for.",
  VALIDATION: "Please check the details and try again.",
  CONFLICT: "That change conflicts with existing data.",
  RATE_LIMITED: "Too many requests. Please try again in a moment.",
  PAYMENT: "The payment could not be completed.",
  INTERNAL: "Something went wrong on our side. Please try again.",
};

/**
 * An error whose message is written for the person reading it. Anything that
 * is not an AppError is reported as a generic message.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Extra detail for the server log only — never returned to the caller. */
  readonly context?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, context?: Record<string, unknown>) {
    super(message || SAFE_MESSAGE[code]);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.context = context;
  }
}

export const unauthenticated = (message?: string) => new AppError("UNAUTHENTICATED", message);
export const forbidden = (message?: string, context?: Record<string, unknown>) =>
  new AppError("FORBIDDEN", message, context);
export const notFound = (message?: string) => new AppError("NOT_FOUND", message);
export const invalid = (message?: string) => new AppError("VALIDATION", message);
export const conflict = (message?: string) => new AppError("CONFLICT", message);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Turn any thrown value into something safe to send back, logging the real
 * cause. `event` identifies the call site in the logs, e.g. "action.savePackage".
 */
export function toSafeError(
  error: unknown,
  event: string,
  context?: Record<string, unknown>,
): { code: ErrorCode; status: number; message: string } {
  if (isAppError(error)) {
    // Expected, already-safe failures are logged at a lower level.
    const level = error.status >= 500 ? "error" : "warn";
    logger[level](event, { ...context, ...error.context, code: error.code, message: error.message });
    return { code: error.code, status: error.status, message: error.message };
  }

  logger.error(event, { ...context, error });
  return { code: "INTERNAL", status: 500, message: SAFE_MESSAGE.INTERNAL };
}

/** Standard Server Action result shape used across the admin panel. */
export type ActionResult<T extends Record<string, unknown> = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
