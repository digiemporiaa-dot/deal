import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { UserManager } from "@/components/admin/UserManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const role = session?.user?.role;
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN";

  return (
    <div>
      <PageHeader title="Team Members" description="Create admin panel users and control their roles and access" />
      <UserManager
        users={users.map((u: { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: Date }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={session?.user?.id || ""}
        canManage={canManage}
      />
      {!canManage && (
        <p className="mt-4 text-sm text-slate-500">Only Super Admins and Admins can add or change users.</p>
      )}
    </div>
  );
}
