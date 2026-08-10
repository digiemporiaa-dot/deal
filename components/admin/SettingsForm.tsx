"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Loader2, Check } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { SiteSettings } from "@/lib/settings";
import { saveSettingsAction } from "@/app/admin/(panel)/settings/actions";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const { register, handleSubmit } = useForm<SiteSettings>({ defaultValues: initial });
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
