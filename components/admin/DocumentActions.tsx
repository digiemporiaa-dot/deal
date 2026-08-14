"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, IndianRupee, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { emailDocument, recordPayment, deleteDocument } from "@/app/admin/(panel)/quotations/actions";
import { Input } from "@/components/ui/Field";
import type { DocKind } from "@/lib/documents";

export function DocumentActions({
  id,
  kind,
  status,
  hasEmail,
  balance,
}: {
  id: string;
  kind: DocKind;
  status: string;
  hasEmail: boolean;
  balance: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const isInvoice = kind === "INVOICE";

  const send = async () => {
    setBusy("email");
    setMsg(null);
    const res = await emailDocument(id);
    setMsg(res.ok ? { ok: true, text: "Sent to the customer" } : { ok: false, text: res.error });
    router.refresh();
    setBusy(null);
  };

  const pay = async () => {
    const value = Number(amount);
    if (!(value > 0)) return;
    setBusy("pay");
    setMsg(null);
    const res = await recordPayment(id, value);
    setMsg(res.ok ? { ok: true, text: `Payment of ₹${value.toLocaleString("en-IN")} recorded` } : { ok: false, text: res.error });
    setAmount("");
    router.refresh();
    setBusy(null);
  };

  const remove = async () => {
    if (!confirm("Delete this document permanently?")) return;
    setBusy("delete");
    await deleteDocument(id);
    router.push(`/admin/${isInvoice ? "invoices" : "quotations"}`);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={busy !== null || !hasEmail}
          title={hasEmail ? "" : "Add a customer email first"}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Email to customer
        </button>

        {isInvoice && balance > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-36">
              <Input
                type="number"
                min={0}
                placeholder="Amount received"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10"
              />
            </div>
            <button
              type="button"
              onClick={pay}
              disabled={busy !== null || !amount}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {busy === "pay" ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
              Record payment
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Current status: <span className="font-semibold text-slate-700">{status}</span>
        {isInvoice && balance > 0 && <> · Balance due ₹{balance.toLocaleString("en-IN")}</>}
      </p>

      {msg && (
        <p className={`inline-flex items-start gap-2 rounded-lg p-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {msg.text}
        </p>
      )}
    </div>
  );
}
