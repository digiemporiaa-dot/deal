"use client";

import * as React from "react";
import { useForm, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { Loader2, Check, Plus, Trash2 } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { SiteSettings } from "@/lib/settings";
import { saveSettingsAction } from "@/app/admin/(panel)/settings/actions";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const { register, handleSubmit, control } = useForm<SiteSettings>({ defaultValues: initial });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const onSubmit = async (values: SiteSettings) => {
    setSaving(true);
    setSaved(false);
    const res = await saveSettingsAction(values);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Group title="Business information">
        <Row><Field label="Website name"><Input {...register("siteName")} /></Field><Field label="Tagline"><Input {...register("tagline")} /></Field></Row>
        <Row><Field label="Email"><Input type="email" {...register("email")} /></Field><Field label="Phone"><Input {...register("phone")} /></Field></Row>
        <Row><Field label="WhatsApp number (digits only)"><Input {...register("whatsapp")} placeholder="919876543210" /></Field><Field label="Business hours"><Input {...register("businessHours")} /></Field></Row>
        <Field label="Address"><Textarea rows={2} {...register("address")} /></Field>
        <Row><Field label="Logo URL"><Input {...register("logoUrl")} /></Field><Field label="Favicon URL"><Input {...register("faviconUrl")} /></Field></Row>
      </Group>

      <Group title="Pricing & currency">
        <Row>
          <Field label="Currency"><Input {...register("currency")} placeholder="INR" /></Field>
          <Field label="Tax (%)"><Input type="number" step="0.01" {...register("taxPercent")} /></Field>
          <Field label="Advance payment (%)"><Input type="number" step="1" {...register("advancePercent")} /></Field>
        </Row>
      </Group>

      <Group title="Social links">
        <Row><Field label="Instagram"><Input {...register("social.instagram")} /></Field><Field label="Facebook"><Input {...register("social.facebook")} /></Field></Row>
        <Row><Field label="Twitter / X"><Input {...register("social.twitter")} /></Field><Field label="YouTube"><Input {...register("social.youtube")} /></Field></Row>
        <Field label="LinkedIn"><Input {...register("social.linkedin")} /></Field>
      </Group>

      <Group title="Menu & footer links">
        <p className="text-sm text-slate-500">Control which links appear in the website header menu and footer columns. Use paths like <code className="rounded bg-slate-100 px-1">/about</code> or <code className="rounded bg-slate-100 px-1">/packages</code>.</p>
        <LinkListEditor title="Header menu links" name="navigation.headerLinks" control={control} register={register} />
        <Field label="Footer column 1 title"><Input {...register("navigation.footerExploreTitle")} /></Field>
        <LinkListEditor title="Footer column 1 links" name="navigation.footerExploreLinks" control={control} register={register} />
        <Field label="Footer column 2 title"><Input {...register("navigation.footerSupportTitle")} /></Field>
        <LinkListEditor title="Footer column 2 links" name="navigation.footerSupportLinks" control={control} register={register} />
      </Group>

      <Group title="Analytics & marketing">
        <Row>
          <Field label="Google Analytics ID"><Input {...register("analytics.googleAnalyticsId")} placeholder="G-XXXXXXX" /></Field>
          <Field label="Meta Pixel ID"><Input {...register("analytics.metaPixelId")} /></Field>
        </Row>
        <Field label="Google Tag Manager ID"><Input {...register("analytics.googleTagManagerId")} placeholder="GTM-XXXXXX" /></Field>
      </Group>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save settings"}
        </Button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Saved</span>}
      </div>
    </form>
  );
}

function LinkListEditor({
  title,
  name,
  control,
  register,
}: {
  title: string;
  name: "navigation.headerLinks" | "navigation.footerExploreLinks" | "navigation.footerSupportLinks";
  control: Control<SiteSettings>;
  register: UseFormRegister<SiteSettings>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={() => append({ label: "", href: "" })}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add link
        </button>
      </div>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input placeholder="Label (e.g. About)" {...register(`${name}.${index}.label` as const)} />
            <Input placeholder="Path (e.g. /about)" {...register(`${name}.${index}.href` as const)} />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label="Remove link"
              className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {fields.length === 0 && <p className="text-sm text-slate-400">No links — click "Add link".</p>}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 font-semibold text-slate-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}
