"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, KeyRound, X } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createUser, updateUser, deleteUser } from "@/app/admin/(panel)/users/actions";

const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin — full control, can manage users" },
  { value: "ADMIN", label: "Admin — full control, can manage users" },
  { value: "CONTENT_MANAGER", label: "Content Manager — pages, blogs, media" },
  { value: "BOOKING_MANAGER", label: "Booking Manager — bookings, leads, customers" },
  { value: "SALES_EXECUTIVE", label: "Sales Executive — bookings, coupons, own leads only" },
] as const;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export function UserManager({ users, currentUserId, canManage }: { users: UserRow[]; currentUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // New user form state
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<string>("CONTENT_MANAGER");
  const [creating, setCreating] = React.useState(false);

  const run = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    setError(null);
    const res = await fn();
    setBusyId(null);
    if (!res.ok) setError(res.error || "Something went wrong.");
    router.refresh();
  };

  const onCreate = async () => {
    setCreating(true);
    setError(null);
    const res = await createUser({ name, email, password, role: role as never });
    setCreating(false);
    if (res.ok) {
      setShowForm(false);
      setName(""); setEmail(""); setPassword(""); setRole("CONTENT_MANAGER");
      router.refresh();
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => { setShowForm((v) => !v); setError(null); }}>
            {showForm ? <><X className="h-4 w-4" /> Close</> : <><Plus className="h-4 w-4" /> Add User</>}
          </Button>
        </div>
      )}

      {canManage && showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Add a new team member</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Password * (min 8 characters)</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Share this with them privately" /></div>
            <div><Label>Role *</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={onCreate} disabled={creating || !name || !email || password.length < 8}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create User"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.name}
                      {isSelf && <Badge tone="brand" className="ml-2">You</Badge>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      {canManage && !isSelf ? (
                        <Select
                          value={u.role}
                          disabled={busy}
                          onChange={(e) => run(u.id, () => updateUser(u.id, { role: e.target.value as never }))}
                          className="max-w-[180px]"
                        >
                          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.value.replace(/_/g, " ")}</option>)}
                        </Select>
                      ) : (
                        <Badge tone="brand">{u.role.replace(/_/g, " ")}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && !isSelf ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(u.id, () => updateUser(u.id, { isActive: !u.isActive }))}
                          title="Click to toggle"
                        >
                          <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "Active" : "Disabled"}</Badge>
                        </button>
                      ) : (
                        <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "Active" : "Disabled"}</Badge>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                          <button
                            type="button"
                            disabled={busy}
                            title="Reset password"
                            onClick={() => {
                              const pw = prompt(`New password for ${u.name} (min 8 characters):`);
                              if (pw && pw.length >= 8) run(u.id, () => updateUser(u.id, { password: pw }));
                              else if (pw) alert("Password must be at least 8 characters.");
                            }}
                            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              disabled={busy}
                              title="Delete user"
                              onClick={() => { if (confirm(`Delete ${u.name}? This cannot be undone.`)) run(u.id, () => deleteUser(u.id)); }}
                              className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
