import type { NextAuthConfig } from "next-auth";
import { canAccessPath, landingPathFor } from "@/lib/permissions";

/**
 * Edge-safe auth config (no Prisma / bcrypt imports) so it can be used inside
 * middleware. The credentials provider itself is added in `lib/auth.ts`, which
 * runs only in the Node.js runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/admin/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isAdminArea = pathname.startsWith("/admin");
      const isLoginPage = pathname === "/admin/login";
      if (!isAdminArea) return true;
      if (isLoginPage) return true;
      if (!auth?.user) return false;

      // Role-based access: send users to the dashboard if the section
      // is outside their role's permissions.
      const role = (auth.user as { role?: string }).role;
      if (!canAccessPath(role, pathname)) {
        return Response.redirect(new URL(landingPathFor(role), request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
