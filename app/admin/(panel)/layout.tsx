import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-slate-50 lg:flex-row flex-col">
      <Sidebar userName={session.user.name || "Admin"} userRole={session.user.role || "ADMIN"} />
      <div className="flex-1 lg:pl-0">
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
