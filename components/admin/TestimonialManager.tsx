"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Star, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input, Textarea, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { saveTestimonial, deleteTestimonial, toggleTestimonial } from "@/app/admin/(panel)/testimonials/actions";

type Item = { id: string; customerName: string; rating: number; review: string; destination: string | null; published: boolean };

export function TestimonialManager({ items, packages }: { items: Item[]; packages: { id: string; name: string }[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ customerName: "", rating: 5, review: "", destination: "", image: "", packageId: "", published: true });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await saveTestimonial(form);
    setSaving(false);
    if (res.ok) {
      setForm({ customerName: "", rating: 5, review: "", destination: "", image: "", packageId: "", published: true });
      setShowForm(false);
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Button onClick={() => setShowForm((v) => !v)}><Plus className="h-4 w-4" /> {showForm ? "Close" : "Add Testimonial"}</Button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Customer name *</Label><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required /></div>
            <div><Label>Rating</Label>
              <Select value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}
              </Select>
            </div>
            <div><Label>Destination</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
            <div><Label>Related package</Label>
              <Select value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}>
                <option value="">None</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Photo URL</Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Review *</Label><Textarea rows={3} value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} required /></div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Published</label>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{t.customerName}</p>
                <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={i < t.rating ? "h-3.5 w-3.5 fill-amber-400 text-amber-400" : "h-3.5 w-3.5 text-slate-300"} />)}</div>
              </div>
              <Badge tone={t.published ? "green" : "slate"}>{t.published ? "Published" : "Hidden"}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">&ldquo;{t.review}&rdquo;</p>
            {t.destination && <p className="mt-1 text-xs text-slate-400">{t.destination}</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={async () => { await toggleTestimonial(t.id); router.refresh(); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">
                {t.published ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Show</>}
              </button>
              <button onClick={async () => { if (confirm("Delete this testimonial?")) { await deleteTestimonial(t.id); router.refresh(); } }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
