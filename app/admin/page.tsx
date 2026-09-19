import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { landingPathFor } from "@/lib/permissions";

/**
 * Entry point for the admin area. Sends each role to the first section it is
 * allowed to open, so a role without a dashboard never lands on a 403.
 */
export default async function AdminIndex() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  redirect(landingPathFor((session.user as { role?: string }).role));
}
