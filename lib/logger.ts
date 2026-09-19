/**
 * Structured server-side logging.
 *
 * One JSON line per event so a log drain (Vercel, Datadog, CloudWatch…) can
 * index it. Never call this with a password, token, card number or full
 * payment payload — `redact()` strips the obvious ones, but the rule is to
 * pass only what you need.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

/** Keys whose values are replaced with "[redacted]" wherever they appear. */
const SECRET_KEYS = [
  "password",
  "passwordhash",
  "newpassword",
  "currentpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "sessiontoken",
  "secret",
  "clientsecret",
  "apikey",
  "authorization",
  "cookie",
  "signature",
  "razorpay_signature",
  "keysecret",
  "card",
  "cvv",
  "otp",
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.includes(key.toLowerCase())
        ? "[redacted]"
        : redact(raw, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}…[truncated]`;
  }
  return value;
}

function write(level: LogLevel, event: string, context?: LogContext): void {
  const line = {
    level,
    event,
    time: new Date().toISOString(),
    ...(context ? (redact(context) as LogContext) : {}),
  };

  // Vitest and local development read better without JSON noise.
  const serialised = JSON.stringify(line);
  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else if (level === "debug") {
    if (process.env.NODE_ENV === "development") console.debug(serialised);
  } else console.log(serialised);
}

export const logger = {
  debug: (event: string, context?: LogContext) => write("debug", event, context),
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),

  /** Payment lifecycle — amounts and ids only, never signatures or keys. */
  payment: (event: string, context?: LogContext) =>
    write("info", `payment.${event}`, context),

  /** Authentication outcomes. Log the email only on success. */
  auth: (event: string, context?: LogContext) =>
    write("info", `auth.${event}`, context),

  /** Privileged admin operations, mirrored into the ActivityLog table. */
  admin: (event: string, context?: LogContext) =>
    write("info", `admin.${event}`, context),

  /** Denied authorization attempts — useful for spotting probing. */
  security: (event: string, context?: LogContext) =>
    write("warn", `security.${event}`, context),
};

export { redact as redactForLog };
