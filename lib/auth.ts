import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { loginSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { unauthenticated } from "@/lib/errors";

/**
 * A bcrypt hash of a value nobody can log in with. Comparing against it when
 * the email is unknown keeps the response time of "no such user" and "wrong
 * password" the same, so the login form cannot be used to enumerate accounts.
 */
const DUMMY_HASH = "$2a$12$168Guq2YTjOl6LuypWVZiuVmdfA6gBKVxombN7KcULsWtfaoeUTxG";

/** Work factor for new and rotated passwords. */
export const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Write a login/logout row without importing the audit module (avoids a cycle). */
async function recordAuthEvent(input: {
  action: "LOGIN" | "LOGOUT";
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  description: string;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        userRole: input.userRole ?? null,
        action: input.action,
        entity: "Auth",
        entityId: input.userId ?? null,
        description: input.description,
      },
    });
  } catch (error) {
    logger.error("activity.auth_write_failed", { action: input.action, error });
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();

        // Throttle per account as well as per IP (the route handler limits the
        // IP). Ten attempts per email per fifteen minutes.
        if (!checkRateLimit(`login:email:${email}`, 10, 15 * 60_000)) {
          logger.security("login_rate_limited", { email });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always run a comparison so timing does not reveal whether the
        // account exists or is disabled.
        const hash = user?.isActive && user.passwordHash ? user.passwordHash : DUMMY_HASH;
        const valid = await bcrypt.compare(parsed.data.password, hash);

        if (!user || !user.isActive || !user.passwordHash || !valid) {
          logger.security("login_failed", { email, reason: !user ? "unknown_user" : !user.isActive ? "inactive" : "bad_password" });
          return null;
        }

        logger.auth("login_success", { userId: user.id, email: user.email, role: user.role });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      await recordAuthEvent({
        action: "LOGIN",
        userId: user.id ?? null,
        userName: user.name ?? user.email ?? null,
        userRole: (user as { role?: string }).role ?? null,
        description: `${user.name || user.email || "A user"} signed in`,
      });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      await recordAuthEvent({
        action: "LOGOUT",
        userId: (token?.id as string | undefined) ?? null,
        userName: (token?.name as string | undefined) ?? null,
        userRole: (token?.role as string | undefined) ?? null,
        description: `${token?.name || "A user"} signed out`,
      });
    },
  },
});

export { ADMIN_ROLES } from "@/lib/permissions";

/**
 * Guard for Server Actions / route handlers — throws if not authenticated.
 *
 * Authentication only. Anything privileged must additionally call
 * `requirePermission()` from `lib/guard.ts`.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw unauthenticated();
  return session;
}
