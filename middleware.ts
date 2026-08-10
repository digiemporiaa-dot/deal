import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe: uses only the base config (no Prisma/bcrypt). The `authorized`
// callback in authConfig enforces auth on /admin/** (except /admin/login).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*"],
};
