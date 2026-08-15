"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ArrowRight, Power } from "lucide-react";
import { saveRedirect, toggleRedirect, deleteRedirect } from "@/app/admin/(panel)/redirects/actions";
import { Input, Label, Select } from "@/components/ui/Field";
import { Card, EmptyState } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";

export type RedirectRow = {
  id: string;
  source: string;
  target: string;
  permanent: boolean;
  isActive: boolean;
  hits: number;
  note: string | null;
};

export function RedirectManager({ rows }: { rows: RedirectRow[] }) {
  const router = useRouter();
  const [source, setSource] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [permanent, setPermanent] = React.useState("301");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const add = async () => {
    setPending(true);
    setError(null);
    const res = await saveRedirect({
      source,
      target,
      permanent: permanent === "301",
      isActive: true,
      note,
    });
    if (!res.ok) setError(res.error);
    else {
      setSource("");
      setTarget("");
      setNote("");
      router.refresh();
    }
    setPending(false);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Add a redirect</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Old URL (that no longer works)</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="/old-bali-package" />
          </div>
          <div>
            <Label>Send visitors to</Label>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="/packages/bali-honeymoon" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={permanent} onChange={(e) => setPermanent(e.target.value)}>
              <option value="301">Permanent (301) — moved for good</option>
              <option value="302">Temporary (302) — will come back</option>
            </Select>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Renamed during Nov cleanup" />
          </div>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending || !source.trim() || !target.trim()}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add redirect
        </button>
        {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <p className="mt-3 text-xs text-slate-500">
          Use this whenever you change a page or package address, so old Google links and shared
          WhatsApp links keep working instead of showing a 404.
        </p>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No redirects yet"
          description="When you rename a page, add its old address here so visitors and Google still find it."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Redirect</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">Used</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{r.source}</code>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        <code className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{r.target}</code>
                      </div>
                      {r.note && <p className="mt-1 text-xs text-slate-400">{r.note}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={r.permanent ? "brand" : "amber"}>{r.permanent ? "301" : "302"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.hits}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.isActive ? "green" : "slate"}>{r.isActive ? "Active" : "Off"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={r.isActive ? "Turn off" : "Turn on"}
                          onClick={async () => {
                            await toggleRedirect(r.id, !r.isActive);
                            router.refresh();
                          }}
                          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async () => {
                            if (!confirm(`Delete the redirect for ${r.source}?`)) return;
                            await deleteRedirect(r.id);
                            router.refresh();
                          }}
                          className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
