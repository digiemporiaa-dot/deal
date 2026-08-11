"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { savePage, type ActionResult, type PageInput } from "@/app/admin/(panel)/pages/actions";

type SectionValue = { heading: string; level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; body: string };

type FormValues = {
  title: string; slug: string; status: "DRAFT" | "PUBLISHED";
  seoTitle: string; seoDescription: string; ogImage: string;
  sections: SectionValue[];
  faqs: { question: string; answer: string }[];
};

const EMPTY_SECTION: SectionValue = { heading: "", level: "h2", body: "<p></p>" };

export function PageForm({
  initial,
  pageId,
}: {
  initial?: Partial<FormValues>;
  pageId?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: "", slug: "", status: "PUBLISHED", seoTitle: "", seoDescription: "", ogImage: "",
      sections: [{ ...EMPTY_SECTION }], faqs: [],
      ...initial,
    },
  });
  const sectionArray = useFieldArray({ control, name: "sections" });
  const faqArray = useFieldArray({ control, name: "faqs" });

  const onSubmit = async (v: FormValues) => {
    setSubmitting(true);
    setError(null);
    const payload: PageInput = {
      title: v.title, slug: v.slug || "",
      sections: v.sections,
      status: v.status, seoTitle: v.seoTitle, seoDescription: v.seoDescription,
      ogImage: v.ogImage, faqs: v.faqs,
    };
    const res: ActionResult = await savePage(payload, pageId);
    if (res.ok) { router.push("/admin/pages"); router.refresh(); }
    else { setError(res.error); setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div><Label>Page title *</Label><Input {...register("title", { required: "Title is required" })} /><FieldError message={errors.title?.message} /></div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Content sections</h2>
          <button
            type="button"
            onClick={() => sectionArray.append({ ...EMPTY_SECTION })}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add section
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">Each section has an optional heading and its own content. Sections appear on the page in this order. Tip: your page title is already the H1, so use H2 for section headings.</p>
        <div className="space-y-4">
          {sectionArray.fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Section {index + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => sectionArray.move(index, index - 1)}
                    aria-label="Move up"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === sectionArray.fields.length - 1}
                    onClick={() => sectionArray.move(index, index + 1)}
                    aria-label="Move down"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (sectionArray.fields.length > 1 || confirm("Remove the only section?")) sectionArray.remove(index); }}
                    aria-label="Remove section"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1"><Label>Heading (optional)</Label><Input {...register(`sections.${index}.heading` as const)} placeholder="e.g. Why Choose Us" /></div>
                  <div className="w-28"><Label>Level</Label>
                    <Select {...register(`sections.${index}.level` as const)}>
                      <option value="h2">H2</option>
                      <option value="h3">H3</option>
                      <option value="h4">H4</option>
                      <option value="h5">H5</option>
                      <option value="h6">H6</option>
                      <option value="h1">H1</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Content</Label>
                  <Controller
                    control={control}
                    name={`sections.${index}.body` as const}
                    render={({ field: f }) => <RichTextEditor value={f.value} onChange={f.onChange} />}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Page settings</h2>
          <div><Label>Slug (URL)</Label><Input {...register("slug")} placeholder="about" /><p className="mt-1 text-xs text-slate-500">The page shows at yoursite.com/slug — for example "about" makes /about. Be careful changing this on an existing page.</p></div>
          <div><Label>Status</Label>
            <Select {...register("status")}>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft (hidden)</option>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">SEO</h2>
          <div><Label>SEO title</Label><Input {...register("seoTitle")} /></div>
          <div><Label>Meta description</Label><Textarea rows={2} {...register("seoDescription")} /></div>
          <div><Label>Featured / OG image URL (optional)</Label><Input {...register("ogImage")} placeholder="https://…/image.jpg" /><p className="mt-1 text-xs text-slate-500">Shown when the page is shared on WhatsApp, Facebook, etc. Recommended size 1200×630.</p></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">FAQs (optional)</h2>
          <button
            type="button"
            onClick={() => faqArray.append({ question: "", answer: "" })}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add FAQ
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">FAQs show at the bottom of the page and automatically add FAQ schema markup for Google.</p>
        <div className="space-y-4">
          {faqArray.fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">FAQ {index + 1}</span>
                <button
                  type="button"
                  onClick={() => faqArray.remove(index)}
                  aria-label="Remove FAQ"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div><Label>Question</Label><Input {...register(`faqs.${index}.question` as const)} placeholder="e.g. Do you arrange visas?" /></div>
                <div><Label>Answer</Label><Textarea rows={3} {...register(`faqs.${index}.answer` as const)} /></div>
              </div>
            </div>
          ))}
          {faqArray.fields.length === 0 && <p className="text-sm text-slate-400">No FAQs — click "Add FAQ" if you want a FAQ section on this page.</p>}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/pages")}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : pageId ? "Update Page" : "Create Page"}</Button>
      </div>
    </form>
  );
}
