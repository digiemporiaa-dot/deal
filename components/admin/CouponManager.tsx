"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { saveCoupon, deleteCoupon } from "@/app/admin/(panel)/coupons/actions";
import { formatDate } from "@/lib/utils";

type Coupon = {
  id: string; code: string; discountType: "PERCENTAGE" | "FIXED"; discountAmount: number;
  minAmount: number | null; maxDiscount: number | null; expiryDate: string | null;
  usageLimit: number | null; usedCount: number; active: boolean;
};

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [show, setShow] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    code: "", discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED", discountAmount: 10,
    minAmount: "", maxDiscount: "", startDate: "", expiryDate: "", usageLimit: "", active: true,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await saveCoupon({
      code: form.code,
      discountType: form.discountType,
      discountAmount: Number(form.discountAmount),
      minAmount: form.minAmount ? Number(form.minAmount) : undefined,
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      startDate: form.startDate,
      expiryDate: form.expiryDate,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      active: form.active,
      packageIds: [],
    });
    setSaving(false);
    if (res.ok) { setShow(false); router.refresh(); }
    else alert(res.error);
  };

  return (
    <div>
      <div className="mb-4"><Button onClick={() => setShow((v) => !v)}><Plus className="h-4 w-4" /> {show ? "Close" : "Add Coupon"}</Button></div>

      {show && (
        <form onSubmit={submit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><Label>Code *</Label><Input className="uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></div>
            <div><Label>Type</Label>
              <Select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "PERCENTAGE" | "FIXED" })}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed amount</option>
              </Select>
            </div>
            <div><Label>Discount value *</Label><Input type="number" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })} /></div>
            <div><Label>Min order amount</Label><Input type="number" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} /></div>
            <div><Label>Max discount</Label><Input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} /></div>
            <div><Label>Usage limit</Label><Input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} /></div>
            <div><Label>Start date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>Expiry date</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Active</label>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save coupon"}</Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Min / Max</th><th className="px-4 py-3">Usage</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No coupons yet.</td></tr>}
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{c.code}</td>
                  <td className="px-4 py-3 text-slate-600">{c.discountType === "PERCENTAGE" ? `${c.discountAmount}%` : `₹${c.discountAmount}`}</td>
                  <td className="px-4 py-3 text-slate-500">{c.minAmount ? `min ₹${c.minAmount}` : "—"}{c.maxDiscount ? ` / max ₹${c.maxDiscount}` : ""}</td>
                  <td className="px-4 py-3 text-slate-500">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                  <td className="px-4 py-3 text-slate-500">{c.expiryDate ? formatDate(c.expiryDate) : "—"}</td>
                  <td className="px-4 py-3"><Badge tone={c.active ? "green" : "slate"}>{c.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={async () => { if (confirm("Delete coupon?")) { await deleteCoupon(c.id); router.refresh(); } }} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
