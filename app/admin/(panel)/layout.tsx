import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/admin/Sidebar";
import { ToastProvider } from "@/components/admin/Toast";

/**
 * Admin shell.
 *
 * The middleware has already checked the JWT, but a JWT keeps whatever role
 * it was minted with: disabling an account or demoting someone would not take
 * effect until their token expired. So the account is re-read here on every
 * admin page load, and the sidebar is built from the role in the database
 * rather than the one in the cookie.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    // The account was disabled or deleted while the session was still valid.
    await signOut({ redirect: false });
    redirect("/admin/login?reason=account-disabled");
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
        <Sidebar userName={user.name || "Admin"} userRole={user.role} />
        <div className="min-w-0 flex-1">
          <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
