"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { DestinationInput } from "@/lib/validation";
import { createDestination, updateDestination, type ActionResult } from "@/app/admin/(panel)/destinations/actions";

type FormValues = {
  name: string; slug: string; country: string; state: string; city: string;
  shortDescription: string; description: string; coverImage: string;
  bestTimeToVisit: string; travelInformation: string;
  isFeatured: boolean; isPublished: boolean; seoTitle: string; seoDescription: string;
  highlights: { value: string }[];
  images: { url: string; alt: string }[];
  faqs: { question: string; answer: string }[];
};

export function DestinationForm({ initial, destinationId }: { initial?: Partial<FormValues>; destinationId?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: "", slug: "", country: "", state: "", city: "", shortDescription: "", description: "",
      coverImage: "", bestTimeToVisit: "", travelInformation: "", isFeatured: false, isPublished: true,
      seoTitle: "", seoDescription: "",
      highlights: [{ value: "" }], images: [], faqs: [],
      ...initial,
    },
  });

  const highlights = useFieldArray({ control, name: "highlights" });
  const images = useFieldArray({ control, name: "images" });
  const faqs = useFieldArray({ control, name: "faqs" });

  const onSubmit = async (v: FormValues) => {
    setSubmitting(true);
    setError(null);
    const payload: DestinationInput = {
      name: v.name, slug: v.slug || "", country: v.country, state: v.state, city: v.city,
      shortDescription: v.shortDescription, description: v.description, coverImage: v.coverImage,
      bestTimeToVisit: v.bestTimeToVisit, travelInformation: v.travelInformation,
      isFeatured: v.isFeatured, isPublished: v.isPublished, seoTitle: v.seoTitle, seoDescription: v.seoDescription,
      highlights: v.highlights.map((h) => h.value).filter(Boolean),
      images: v.images.filter((i) => i.url),
      faqs: v.faqs,
    };
    const res: ActionResult = destinationId ? await updateDestination(destinationId, payload) : await createDestination(payload);
    if (res.ok) {
      router.push("/admin/destinations");
      router.refresh();
    } else {
      setError(res.error);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Basic information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label>Name *</Label><Input {...register("name", { required: "Name is required" })} /><FieldError message={errors.name?.message} /></div>
          <div><Label>Country *</Label><Input {...register("country", { required: "Country is required" })} /><FieldError message={errors.country?.message} /></div>
          <div><Label>State</Label><Input {...register("state")} /></div>
          <div><Label>City</Label><Input {...register("city")} /></div>
          <div className="sm:col-span-2"><Label>Short description *</Label><Input {...register("shortDescription", { required: true })} /></div>
          <div className="sm:col-span-2"><Label>Description *</Label><Textarea rows={5} {...register("description", { required: true })} /></div>
          <div className="sm:col-span-2"><Label>Cover image URL</Label><Input {...register("coverImage")} placeholder="https://…" /></div>
          <div><Label>Best time to visit</Label><Input {...register("bestTimeToVisit")} /></div>
          <div><Label>Slug (optional)</Label><Input {...register("slug")} /></div>
          <div className="sm:col-span-2"><Label>Travel information</Label><Textarea rows={3} {...register("travelInformation")} /></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold text-slate-900">Highlights</h2>
        <div className="space-y-2">
          {highlights.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input {...register(`highlights.${i}.value`)} placeholder="e.g. World-class beaches" />
              <button type="button" onClick={() => highlights.remove(i)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => highlights.append({ value: "" })} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600"><Plus className="h-4 w-4" /> Add highlight</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold text-slate-900">Gallery images</h2>
        <div className="space-y-3">
          {images.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input {...register(`images.${i}.url`)} placeholder="Image URL" />
              <Input {...register(`images.${i}.alt`)} placeholder="Alt text" />
              <button type="button" onClick={() => images.remove(i)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => images.append({ url: "", alt: "" })} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600"><Plus className="h-4 w-4" /> Add image</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold text-slate-900">FAQs</h2>
        <div className="space-y-4">
          {faqs.fields.map((f, i) => (
            <div key={f.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={() => faqs.remove(i)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
              </div>
              <Input className="mb-2" {...register(`faqs.${i}.question`)} placeholder="Question" />
              <Textarea rows={2} {...register(`faqs.${i}.answer`)} placeholder="Answer" />
            </div>
          ))}
          <button type="button" onClick={() => faqs.append({ question: "", answer: "" })} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"><Plus className="h-4 w-4" /> Add FAQ</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">SEO & visibility</h2>
        <div className="grid grid-cols-1 gap-4">
          <div><Label>SEO title</Label><Input {...register("seoTitle")} /></div>
          <div><Label>Meta description</Label><Textarea rows={2} {...register("seoDescription")} /></div>
          <label className="flex items-center gap-3"><input type="checkbox" {...register("isPublished")} className="h-5 w-5 rounded border-slate-300 text-brand-600" /> Published</label>
          <label className="flex items-center gap-3"><input type="checkbox" {...register("isFeatured")} className="h-5 w-5 rounded border-slate-300 text-brand-600" /> Featured</label>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/destinations")}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : destinationId ? "Update Destination" : "Create Destination"}
        </Button>
      </div>
    </form>
  );
}
