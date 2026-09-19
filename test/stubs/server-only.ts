/**
 * Stub for the `server-only` package under Vitest.
 *
 * `server-only` exists so a bundler can fail the build when a server module
 * is imported into client code; it has no Node entry point. Vitest has no
 * bundler boundary to enforce, so it is aliased to this empty module.
 */
export {};
