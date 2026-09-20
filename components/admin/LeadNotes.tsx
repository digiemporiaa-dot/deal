"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { addLeadNote } from "@/app/admin/(panel)/leads/actions";
import { Textarea } from "@/components/ui/Field";

type Note = { id: string; body: string; createdAt: string; author: string | null };

export function LeadNotes({ leadId, notes }: { leadId: string; notes: Note[] }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    await addLeadNote(leadId, body);
    setBody("");
    router.refresh();
    setPending(false);
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-4">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add an internal note (e.g. called customer, sent quote)…" rows={3} />
        <button type="submit" disabled={pending || !body.trim()} className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Add note
        </button>
      </form>
      <div className="space-y-3">
        {notes.length === 0 && <p className="text-sm text-admin-text-subtle">No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-xl border border-admin p-3">
            <p className="text-sm text-admin-text">{n.body}</p>
            <p className="mt-1 text-xs text-admin-text-subtle">{n.author || "Team"} · {new Date(n.createdAt).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
