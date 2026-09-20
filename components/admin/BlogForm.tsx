"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import type { BlogInput } from "@/lib/validation";
import { saveBlog, type ActionResult } from "@/app/admin/(panel)/blogs/actions";

type FormValues = {
  title: string; slug: string; excerpt: string; coverImage: string;
  categoryId: string; status: "DRAFT" | "PUBLISHED"; featured: boolean;
  tags: string; seoTitle: string; seoDescription: string;
  /** Editorial links that drive the related-content sections. */
  destinationId: string; packageId: string;
};

export function BlogForm({
  categories,
  destinations = [],
  packages = [],
  initial,
  initialContent,
  blogId,
}: {
  categories: { id: string; name: string }[];
  destinations?: { id: string; name: string }[];
  packages?: { id: string; name: string }[];
  initial?: Partial<FormValues>;
  initialContent?: string;
  blogId?: string;
}) {
  const router = useRouter();
  const [content, setContent] = React.useState(initialContent ?? "<p></p>");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: "", slug: "", excerpt: "", coverImage: "", categoryId: "", status: "DRAFT",
      featured: false, tags: "", seoTitle: "", seoDescription: "",
      destinationId: "", packageId: "",
      ...initial,
    },
  });

  const onSubmit = async (v: FormValues) => {
    setSubmitting(true);
    setError(null);
    const payload: BlogInput = {
      title: v.title, slug: v.slug || "", excerpt: v.excerpt, content,
      coverImage: v.coverImage, categoryId: v.categoryId, status: v.status, featured: v.featured,
      tags: v.tags ? v.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      seoTitle: v.seoTitle, seoDescription: v.seoDescription,
      destinationId: v.destinationId, packageId: v.packageId,
    };
    const res: ActionResult = await saveBlog(payload, blogId);
    if (res.ok) { router.push("/admin/blogs"); router.refresh(); }
    else { setError(res.error); setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-2xl border border-admin bg-white p-6">
        <div className="grid grid-cols-1 gap-4">
          <div><Label>Title *</Label><Input {...register("title", { required: "Title is required" })} /><FieldError message={errors.title?.message} /></div>
          <div><Label>Excerpt</Label><Textarea rows={2} {...register("excerpt")} placeholder="Short summary for listing cards" /></div>
          <div>
            <Label>Content *</Label>
            <RichTextEditor value={content} onChange={setContent} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-admin bg-white p-6 space-y-4">
          <h2 className="font-semibold text-admin-text">Meta</h2>
          <div><Label>Cover image URL</Label><Input {...register("coverImage")} /></div>
          <div><Label>Category</Label>
            <Select {...register("categoryId")}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div><Label>Tags (comma-separated)</Label><Input {...register("tags")} placeholder="dubai, travel tips" /></div>
          <div><Label>Slug (optional)</Label><Input {...register("slug")} /></div>

          <div className="border-t border-admin pt-4">
            <h3 className="mb-1 text-sm font-semibold text-admin-text">Related content</h3>
            <p className="mb-3 text-xs text-admin-text-muted">
              Link this post to a destination or package and it will appear on those pages, and
              they will appear here.
            </p>
            <div className="space-y-3">
              <div>
                <Label>Destination</Label>
                <Select {...register("destinationId")}>
                  <option value="">None</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Package</Label>
                <Select {...register("packageId")}>
                  <option value="">None</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-admin bg-white p-6 space-y-4">
          <h2 className="font-semibold text-admin-text">SEO & publishing</h2>
          <div><Label>SEO title</Label><Input {...register("seoTitle")} /></div>
          <div><Label>Meta description</Label><Textarea rows={2} {...register("seoDescription")} /></div>
          <div><Label>Status</Label>
            <Select {...register("status")}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("featured")} className="h-4 w-4 rounded border-admin-border-strong text-brand-600" /> Featured post</label>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/blogs")}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : blogId ? "Update Post" : "Create Post"}</Button>
      </div>
    </form>
  );
}
