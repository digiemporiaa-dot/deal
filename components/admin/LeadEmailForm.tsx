"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { sendLeadEmail } from "@/app/admin/(panel)/leads/actions";
import { Input, Textarea, Label } from "@/components/ui/Field";

type Template = { label: string; subject: string; body: string };

const TEMPLATES: Template[] = [
  {
    label: "Thanks for your enquiry",
    subject: "Thank you for your enquiry",
    body:
      "Thank you for reaching out to us about your trip. One of our travel experts is putting together a few options for you.\n\nCould you confirm your preferred travel dates and the number of travellers? We will share a detailed itinerary and pricing shortly.",
  },
  {
    label: "Sending quotation",
    subject: "Your personalised holiday quotation",
    body:
      "As discussed, please find our suggested itinerary and pricing below.\n\n[Add package details, inclusions and price here]\n\nThis quotation is valid for 7 days. Let us know if you would like any changes — we are happy to customise it.",
  },
  {
    label: "Gentle follow-up",
    subject: "Following up on your travel plans",
    body:
      "Just checking in on the itinerary we shared. Do you have any questions, or would you like us to adjust the dates, hotels or budget?\n\nHappy to help whenever you are ready.",
  },
];

export function LeadEmailForm({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const router = useRouter();
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);

  if (!leadEmail) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        This lead did not provide an email address, so email cannot be sent. Use Call or WhatsApp instead.
      </p>
    );
  }

  const applyTemplate = (label: string) => {
    const t = TEMPLATES.find((x) => x.label === label);
    if (!t) return;
    setSubject(t.subject);
    setMessage(t.body);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || pending) return;
    setPending(true);
    setResult(null);
    const res = await sendLeadEmail(leadId, subject, message);
    if (res.ok) {
      setSubject("");
      setMessage("");
      setResult({ ok: true, text: `Email sent to ${leadEmail}` });
    } else {
      setResult({ ok: false, text: res.error });
    }
    router.refresh();
    setPending(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => applyTemplate(t.label)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <Label>To</Label>
        <Input value={leadEmail} readOnly className="bg-slate-50 text-slate-500" />
      </div>

      <div>
        <Label>Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Your Bali itinerary and pricing" />
      </div>

      <div>
        <Label>Message</Label>
        <Textarea
          rows={9}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message. The greeting and signature are added automatically."
        />
        <p className="mt-1 text-xs text-slate-400">
          Sent as a branded email — &ldquo;Hi {"{name}"}&rdquo; at the top and your signature at the bottom are added for you.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending || !subject.trim() || !message.trim()}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {pending ? "Sending…" : "Send email"}
      </button>

      {result && (
        <p
          className={`inline-flex items-start gap-2 rounded-lg p-3 text-sm ${
            result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {result.text}
        </p>
      )}
    </form>
  );
}
