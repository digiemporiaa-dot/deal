"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { Input, Textarea, Select, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { PackageInput } from "@/lib/validation";
import { createPackage, updatePackage, type ActionResult } from "@/app/admin/(panel)/packages/actions";

type Option = { id: string; name: string };

type FormValues = {
  name: string;
  slug: string;
  destinationId: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  durationDays: number;
  durationNights: number;
  startingPrice: number;
  discountPrice?: number;
  currency: string;
  minTravellers: number;
  maxTravellers: number;
  featured: boolean;
  published: boolean;
  bookingEnabled: boolean;
  seoTitle: string;
  seoDescription: string;
  highlights: { value: string }[];
  inclusions: { value: string }[];
  exclusions: { value: string }[];
  images: { url: string; alt: string }[];
  itinerary: { dayNumber: number; title: string; description: string; activities: string; meals: string; hotel: string; transfers: string }[];
  hotels: { name: string; location: string; roomType: string; nights: number; description: string }[];
  activities: { name: string; description: string; price?: number }[];
  faqs: { question: string; answer: string }[];
};

const TABS = [
  "Basic", "Pricing", "Images", "Highlights", "Itinerary",
  "Hotels", "Activities", "Inclusions", "FAQs", "SEO", "Publish",
] as const;

export function PackageForm({
  destinations,
  categories,
  initial,
  packageId,
}: {
  destinations: Option[];
  categories: Option[];
  initial?: Partial<FormValues>;
  packageId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("Basic");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: "", slug: "", destinationId: "", categoryId: "", shortDescription: "", description: "",
      durationDays: 5, durationNights: 4, startingPrice: 0, discountPrice: undefined, currency: "INR",
      minTravellers: 1, maxTravellers: 20, featured: false, published: true, bookingEnabled: true,
      seoTitle: "", seoDescription: "",
      highlights: [{ value: "" }],
      inclusions: [{ value: "" }],
      exclusions: [{ value: "" }],
      images: [{ url: "", alt: "" }],
      itinerary: [{ dayNumber: 1, title: "", description: "", activities: "", meals: "", hotel: "", transfers: "" }],
      hotels: [],
      activities: [],
      faqs: [],
      ...initial,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setError(null);

    const payload: PackageInput = {
      name: values.name,
      slug: values.slug || "",
      destinationId: values.destinationId,
      categoryId: values.categoryId || "",
      shortDescription: values.shortDescription,
      description: values.description,
      durationDays: Number(values.durationDays),
      durationNights: Number(values.durationNights),
      startingPrice: Number(values.startingPrice),
      discountPrice: values.discountPrice ? Number(values.discountPrice) : undefined,
      currency: values.currency,
      minTravellers: Number(values.minTravellers),
      maxTravellers: Number(values.maxTravellers),
      featured: values.featured,
      published: values.published,
      bookingEnabled: values.bookingEnabled,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
      highlights: values.highlights.map((h) => h.value).filter(Boolean),
      inclusions: values.inclusions.map((i) => i.value).filter(Boolean),
      exclusions: values.exclusions.map((e) => e.value).filter(Boolean),
      images: values.images.filter((i) => i.url),
      itinerary: values.itinerary.map((d, i) => ({ ...d, dayNumber: i + 1 })),
      hotels: values.hotels,
      activities: values.activities.map((a) => ({ ...a, price: a.price ? Number(a.price) : undefined })),
      faqs: values.faqs,
    };

    const result: ActionResult = packageId
      ? await updatePackage(packageId, payload)
      : await createPackage(payload);

    if (result.ok) {
      router.push("/admin/packages");
      router.refresh();
    } else {
      setError(result.error);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {/* Basic */}
        <Section show={tab === "Basic"}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Package name *</Label>
              <Input {...register("name", { required: "Name is required" })} placeholder="e.g. Dubai Dazzle — 5 Days" />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label>Destination *</Label>
              <Select {...register("destinationId", { required: "Choose a destination" })}>
                <option value="">Select destination</option>
                {destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <FieldError message={errors.destinationId?.message} />
            </div>
            <div>
              <Label>Category</Label>
              <Select {...register("categoryId")}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Short description *</Label>
              <Input {...register("shortDescription", { required: true })} placeholder="One-line summary shown on cards" />
            </div>
            <div className="sm:col-span-2">
              <Label>Full description *</Label>
              <Textarea rows={6} {...register("description", { required: true })} placeholder="Detailed overview of the package" />
            </div>
            <div>
              <Label>Slug (optional)</Label>
              <Input {...register("slug")} placeholder="auto-generated from name" />
            </div>
          </div>
        </Section>

        {/* Pricing */}
        <Section show={tab === "Pricing"}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Duration (days) *</Label><Input type="number" min={1} {...register("durationDays")} /></div>
            <div><Label>Duration (nights) *</Label><Input type="number" min={0} {...register("durationNights")} /></div>
            <div><Label>Starting price (per person) *</Label><Input type="number" min={0} {...register("startingPrice")} /></div>
            <div><Label>Discount price (optional)</Label><Input type="number" min={0} {...register("discountPrice")} placeholder="Leave blank for none" /></div>
            <div><Label>Currency</Label>
              <Select {...register("currency")}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </Select>
            </div>
            <div />
            <div><Label>Min travellers</Label><Input type="number" min={1} {...register("minTravellers")} /></div>
            <div><Label>Max travellers</Label><Input type="number" min={1} {...register("maxTravellers")} /></div>
          </div>
        </Section>

        {/* Images */}
        <Section show={tab === "Images"}>
          <RepeaterHeader title="Gallery images" hint="Paste image URLs. First image is the cover." />
          <ObjectRepeater
            control={control}
            name="images"
            empty={{ url: "", alt: "" }}
            addLabel="Add image"
            render={(index) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input {...register(`images.${index}.url`)} placeholder="https://…/image.jpg" />
                <Input {...register(`images.${index}.alt`)} placeholder="Alt text (accessibility/SEO)" />
              </div>
            )}
          />
        </Section>

        {/* Highlights */}
        <Section show={tab === "Highlights"}>
          <RepeaterHeader title="Highlights" hint="Key selling points shown on the package page." />
          <StringRepeater control={control} register={register} name="highlights" placeholder="e.g. Desert safari with BBQ dinner" addLabel="Add highlight" />
        </Section>

        {/* Itinerary — unlimited days */}
        <Section show={tab === "Itinerary"}>
          <RepeaterHeader title="Day-by-day itinerary" hint="Add as many days as you need. Days are auto-numbered." />
          <ObjectRepeater
            control={control}
            name="itinerary"
            empty={{ dayNumber: 0, title: "", description: "", activities: "", meals: "", hotel: "", transfers: "" }}
            addLabel="Add Day"
            itemLabel={(i) => `Day ${i + 1}`}
            render={(index) => (
              <div className="grid grid-cols-1 gap-3">
                <Input {...register(`itinerary.${index}.title`)} placeholder="Day title (e.g. Arrival in Dubai)" />
                <Textarea rows={2} {...register(`itinerary.${index}.description`)} placeholder="What happens on this day" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input {...register(`itinerary.${index}.activities`)} placeholder="Activities" />
                  <Input {...register(`itinerary.${index}.meals`)} placeholder="Meals (e.g. Breakfast)" />
                  <Input {...register(`itinerary.${index}.hotel`)} placeholder="Hotel" />
                  <Input {...register(`itinerary.${index}.transfers`)} placeholder="Transfers (e.g. Airport pickup)" />
                </div>
              </div>
            )}
          />
        </Section>

        {/* Hotels */}
        <Section show={tab === "Hotels"}>
          <RepeaterHeader title="Hotels" />
          <ObjectRepeater
            control={control}
            name="hotels"
            empty={{ name: "", location: "", roomType: "", nights: 1, description: "" }}
            addLabel="Add hotel"
            render={(index) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input {...register(`hotels.${index}.name`)} placeholder="Hotel name" />
                <Input {...register(`hotels.${index}.location`)} placeholder="Location" />
                <Input {...register(`hotels.${index}.roomType`)} placeholder="Room type" />
                <Input type="number" min={1} {...register(`hotels.${index}.nights`)} placeholder="Nights" />
                <Input className="sm:col-span-2" {...register(`hotels.${index}.description`)} placeholder="Description" />
              </div>
            )}
          />
        </Section>

        {/* Activities */}
        <Section show={tab === "Activities"}>
          <RepeaterHeader title="Activities" />
          <ObjectRepeater
            control={control}
            name="activities"
            empty={{ name: "", description: "", price: undefined }}
            addLabel="Add activity"
            render={(index) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input {...register(`activities.${index}.name`)} placeholder="Activity name" />
                <Input className="sm:col-span-1" {...register(`activities.${index}.description`)} placeholder="Description" />
                <Input type="number" min={0} {...register(`activities.${index}.price`)} placeholder="Price (optional)" />
              </div>
            )}
          />
        </Section>

        {/* Inclusions / Exclusions */}
        <Section show={tab === "Inclusions"}>
          <RepeaterHeader title="What's included" />
          <StringRepeater control={control} register={register} name="inclusions" placeholder="e.g. Daily breakfast" addLabel="Add inclusion" />
          <div className="my-6 border-t border-slate-100" />
          <RepeaterHeader title="What's not included" />
          <StringRepeater control={control} register={register} name="exclusions" placeholder="e.g. Airfare" addLabel="Add exclusion" />
        </Section>

        {/* FAQs */}
        <Section show={tab === "FAQs"}>
          <RepeaterHeader title="FAQs" />
          <ObjectRepeater
            control={control}
            name="faqs"
            empty={{ question: "", answer: "" }}
            addLabel="Add FAQ"
            render={(index) => (
              <div className="grid grid-cols-1 gap-3">
                <Input {...register(`faqs.${index}.question`)} placeholder="Question" />
                <Textarea rows={2} {...register(`faqs.${index}.answer`)} placeholder="Answer" />
              </div>
            )}
          />
        </Section>

        {/* SEO */}
        <Section show={tab === "SEO"}>
          <div className="grid grid-cols-1 gap-4">
            <div><Label>SEO title</Label><Input {...register("seoTitle")} placeholder="Custom page title for search engines" /></div>
            <div><Label>Meta description</Label><Textarea rows={3} {...register("seoDescription")} placeholder="Up to 160 characters" /></div>
          </div>
        </Section>

        {/* Publish */}
        <Section show={tab === "Publish"}>
          <div className="space-y-4">
            <Toggle register={register} name="published" label="Published" hint="Visible on the public website." />
            <Toggle register={register} name="featured" label="Featured" hint="Show on the homepage and featured sections." />
            <Toggle register={register} name="bookingEnabled" label="Enable online booking" hint="Allow customers to book & pay online." />
          </div>
        </Section>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/packages")}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : packageId ? "Update Package" : "Create Package"}
        </Button>
      </div>
    </form>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function Section({ show, children }: { show: boolean; children: React.ReactNode }) {
  return <div className={show ? "block" : "hidden"}>{children}</div>;
}

function RepeaterHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

function Toggle({
  register, name, label, hint,
}: {
  register: UseFormRegister<FormValues>;
  name: "published" | "featured" | "bookingEnabled";
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
      <input type="checkbox" {...register(name)} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600" />
      <span>
        <span className="block font-medium text-slate-900">{label}</span>
        {hint && <span className="block text-sm text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

// String-array repeater (highlights, inclusions, exclusions)
function StringRepeater({
  control, register, name, placeholder, addLabel,
}: {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  name: "highlights" | "inclusions" | "exclusions";
  placeholder: string;
  addLabel: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <div className="space-y-2">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
          <Input {...register(`${name}.${index}.value`)} placeholder={placeholder} />
          <button type="button" onClick={() => remove(index)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => append({ value: "" })} className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}

// Object-array repeater (images, itinerary, hotels, activities, faqs)
function ObjectRepeater<
  N extends "images" | "itinerary" | "hotels" | "activities" | "faqs",
>({
  control, name, empty, addLabel, itemLabel, render,
}: {
  control: Control<FormValues>;
  name: N;
  empty: FormValues[N][number];
  addLabel: string;
  itemLabel?: (index: number) => string;
  render: (index: number) => React.ReactNode;
}) {
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
          No items yet. Click &ldquo;{addLabel}&rdquo; to begin.
        </p>
      )}
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{itemLabel ? itemLabel(index) : `Item ${index + 1}`}</span>
            <button type="button" onClick={() => remove(index)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
          {render(index)}
        </div>
      ))}
      <button type="button" onClick={() => append(empty as never)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50">
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}
