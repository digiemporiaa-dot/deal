"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { limitFor } from "@/lib/rate-limit";
import { clientIp } from "@/lib/guard";
import { logger } from "@/lib/logger";

export type LoginState = { error?: string } | undefined;

/**
 * One deliberately vague message for every failure mode. Telling the visitor
 * which half was wrong would turn this form into an account checker.
 */
const GENERIC_ERROR = "Invalid email or password.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = await clientIp();
  const throttle = limitFor("login", ip);
  if (!throttle.ok) {
    logger.security("login_ip_rate_limited", { ip });
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }

  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
  });
  if (!parsed.success) return { error: GENERIC_ERROR };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      // /admin forwards each role to the first section it is allowed to open.
      redirectTo: "/admin",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) return { error: GENERIC_ERROR };
    // signIn throws a redirect on success — rethrow so Next handles it.
    throw error;
  }
}
