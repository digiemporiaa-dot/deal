"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { saveDocument, type DocumentInput } from "@/app/admin/(panel)/quotations/actions";
import { Input, Textarea, Select, Label } from "@/components/ui/Field";
import { Card } from "@/components/admin/ui";

type Item = { title: string; description: string; quantity: number; unitPrice: number };

export type DocumentFormValue = {
  id?: string;
  kind: "QUOTATION" | "INVOICE";
  status: string;
  number?: string;
  leadId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  billingAddress: string;
  title: string;
  destination: string;
  travelDate: string;
  travellers: string;
  validUntil: string;
  dueDate: string;
  discount: number;
  taxPercent: number;
  amountPaid: number;
  notes: string;
  terms: string;
  items: Item[];
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export function DocumentForm({ initial, statuses }: { initial: DocumentFormValue; statuses: string[] }) {
  const router = useRouter();
  const [v, setV] = React.useState<DocumentFormValue>(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isInvoice = v.kind === "INVOICE";
  const set = <K extends keyof DocumentFormValue>(key: K, value: DocumentFormValue[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const setItem = (index: number, patch: Partial<Item>) =>
    setV((prev) => ({ ...prev, items: prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));

  const moveItem = (index: number, dir: -1 | 1) =>
    setV((prev) => {
      const items = [...prev.items];
      const target = index + dir;
      if (target < 0 || target >= items.length) return prev;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...prev, items };
    });

  const subtotal = v.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const discount = Math.min(Number(v.discount) || 0, subtotal);
  const taxAmount = Math.round(((subtotal - discount) * (Number(v.taxPercent) || 0)) / 100);
  const total = subtotal - discount + taxAmount;
  const balance = Math.max(total - (Number(v.amountPaid) || 0), 0);

  const submit = async () => {
    setPending(true);
    setError(null);
    const payload: DocumentInput = {
      kind: v.kind,
      status: v.status,
      leadId: v.leadId ?? null,
      customerName: v.customerName,
      customerEmail: v.customerEmail,
      customerPhone: v.customerPhone,
      billingAddress: v.billingAddress,
      title: v.title,
      destination: v.destination,
      travelDate: v.travelDate,
      travellers: v.travellers ? Number(v.travellers) : null,
      validUntil: v.validUntil,
      dueDate: v.dueDate,
      discount: v.discount,
      taxPercent: v.taxPercent,
      amountPaid: v.amountPaid,
      notes: v.notes,
      terms: v.terms,
      items: v.items.map((i) => ({
        title: i.title,
        description: i.description,
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
      })),
    };

    const res = await saveDocument(payload, v.id);
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    router.push(`/admin/${isInvoice ? "invoices" : "quotations"}/${res.id}`);
    router.refresh();
    setPending(false);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Customer</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Name *</Label>
              <Input value={v.customerName} onChange={(e) => set("customerName", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={v.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={v.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
            </div>
            <div>
              <Label>Destination</Label>
              <Input value={v.destination} onChange={(e) => set("destination", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Billing address</Label>
              <Textarea rows={2} value={v.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Line items</h2>
            <button
              type="button"
              onClick={() => set("items", [...v.items, { title: "", description: "", quantity: 1, unitPrice: 0 }])}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>

          <div className="space-y-3">
            {v.items.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      placeholder="e.g. 5 nights in Bali — 4★ resort"
                      value={item.title}
                      onChange={(e) => setItem(i, { title: e.target.value })}
                    />
                    <Input
                      placeholder="Optional description — inclusions, hotel, room type"
                      value={item.description}
                      onChange={(e) => setItem(i, { description: e.target.value })}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-24">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => setItem(i, { quantity: Number(e.target.value) })}
                        />
                      </div>
                      <span className="text-slate-400">×</span>
                      <div className="w-36">
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })}
                        />
                      </div>
                      <span className="ml-auto text-sm font-semibold text-slate-900">
                        {money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => moveItem(i, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveItem(i, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><ArrowDown className="h-4 w-4" /></button>
                    <button
                      type="button"
                      onClick={() => set("items", v.items.filter((_, x) => x !== i))}
                      disabled={v.items.length === 1}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Notes & terms</h2>
          <div className="space-y-4">
            <div>
              <Label>Notes shown to the customer</Label>
              <Textarea rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Inclusions, exclusions, anything they should know" />
            </div>
            <div>
              <Label>Terms &amp; conditions</Label>
              <Textarea rows={3} value={v.terms} onChange={(e) => set("terms", e.target.value)} placeholder="Payment terms, cancellation policy…" />
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-1">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">{isInvoice ? "Invoice" : "Quotation"} details</h2>
          <div className="space-y-4">
            {v.number && (
              <div>
                <Label>Number</Label>
                <Input value={v.number} readOnly className="bg-slate-50 font-semibold text-slate-600" />
              </div>
            )}
            <div>
              <Label>Title</Label>
              <Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Bali honeymoon package" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={v.status} onChange={(e) => set("status", e.target.value)}>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Travel date</Label>
                <Input type="date" value={v.travelDate} onChange={(e) => set("travelDate", e.target.value)} />
              </div>
              <div>
                <Label>Travellers</Label>
                <Input type="number" min={0} value={v.travellers} onChange={(e) => set("travellers", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{isInvoice ? "Payment due by" : "Valid until"}</Label>
              <Input
                type="date"
                value={isInvoice ? v.dueDate : v.validUntil}
                onChange={(e) => set(isInvoice ? "dueDate" : "validUntil", e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Totals</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-semibold">{money(subtotal)}</span>
            </div>
            <div>
              <Label>Discount (₹)</Label>
              <Input type="number" min={0} value={v.discount} onChange={(e) => set("discount", Number(e.target.value))} />
            </div>
            <div>
              <Label>Tax / GST (%)</Label>
              <Input type="number" min={0} max={100} value={v.taxPercent} onChange={(e) => set("taxPercent", Number(e.target.value))} />
            </div>
            {taxAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Tax amount</span>
                <span className="font-semibold">{money(taxAmount)}</span>
              </div>
            )}
            {isInvoice && (
              <div>
                <Label>Amount received (₹)</Label>
                <Input type="number" min={0} value={v.amountPaid} onChange={(e) => set("amountPaid", Number(e.target.value))} />
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="text-xl font-bold text-slate-900">{money(total)}</span>
            </div>
            {isInvoice && Number(v.amountPaid) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">Balance due</span>
                <span className={`font-bold ${balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(balance)}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? "Saving…" : `Save ${isInvoice ? "invoice" : "quotation"}`}
          </button>
          {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        </Card>
      </div>
    </div>
  );
}
