"use client";

import * as React from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { itemStr, list, num, str } from "@/lib/builder/content";
import { readClientAttribution } from "@/lib/client-attribution";
import { EmptyHint } from "@/components/builder/views";
import type { NodeContent } from "@/lib/builder/schema";

/**
 * The interactive elements.
 *
 * Deliberately the only client components a published builder page loads —
 * everything else renders on the server. Each is self-contained so a page
 * using one accordion does not pull in the form code, and none of them import
 * anything from the editor.
 */

type Props = { content?: NodeContent };

/* ───────────────────────── accordion ───────────────────────── */

export function AccordionBlock({ content }: Props) {
  const items = list(content, "items");
  const [open, setOpen] = React.useState<number | null>(0);

  if (items.length === 0) return <EmptyHint label="Add an accordion item" />;

  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {items.map((item, index) => {
        const isOpen = open === index;
        const panelId = `acc-panel-${index}`;
        const buttonId = `acc-button-${index}`;
        return (
          <div key={index}>
            <h3 className="m-0">
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-slate-900 hover:bg-slate-50"
              >
                {itemStr(item, "title")}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="prose-content px-5 pb-5 text-sm text-slate-600"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(itemStr(item, "html")) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── FAQ ───────────────────────────── */

/**
 * Questions and answers. Kept separate from the accordion because its content
 * is plain text, which is what the FAQ structured data on the page describes.
 */
export function FaqBlock({ content }: Props) {
  const items = list(content, "items");
  const [open, setOpen] = React.useState<number | null>(0);

  if (items.length === 0) return <EmptyHint label="Add a question" />;

  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {items.map((item, index) => {
        const isOpen = open === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;
        return (
          <div key={index}>
            <h3 className="m-0">
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-slate-900 hover:bg-slate-50"
              >
                {itemStr(item, "question")}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 text-sm text-slate-600"
              style={{ whiteSpace: "pre-line" }}
            >
              {itemStr(item, "answer")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────  tabs  ────────────────────────── */

export function TabsBlock({ content }: Props) {
  const items = list(content, "items");
  const [active, setActive] = React.useState(0);

  if (items.length === 0) return <EmptyHint label="Add a tab" />;

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200">
        {items.map((item, index) => (
          <button
            key={index}
            role="tab"
            type="button"
            id={`tab-${index}`}
            aria-selected={active === index}
            aria-controls={`tabpanel-${index}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              // Arrow keys move between tabs, which is what a screen-reader
              // user expects from a tablist.
              if (event.key === "ArrowRight") setActive((current) => (current + 1) % items.length);
              if (event.key === "ArrowLeft") setActive((current) => (current - 1 + items.length) % items.length);
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
              active === index
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {itemStr(item, "title") || `Tab ${index + 1}`}
          </button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`tabpanel-${index}`}
          aria-labelledby={`tab-${index}`}
          hidden={active !== index}
          className="prose-content pt-5"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(itemStr(item, "html")) }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────── counter ────────────────────────── */

/** One statistic that counts up the first time it scrolls into view. */
function Counter({ value, label }: { value: string; label: string }) {
  const target = Number(String(value).replace(/[^0-9.]/g, ""));
  const suffix = String(value).replace(/[0-9.,\s]/g, "");
  const [shown, setShown] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const done = React.useRef(false);

  React.useEffect(() => {
    // Without IntersectionObserver, or for someone who asked for reduced
    // motion, the final number is shown immediately.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!Number.isFinite(target) || reduced || typeof IntersectionObserver === "undefined") {
      setShown(target || 0);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || done.current) return;
        done.current = true;

        const duration = 1200;
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          // Ease-out so it decelerates rather than stopping dead.
          setShown(target * (1 - Math.pow(1 - progress, 3)));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.3 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [target]);

  const decimals = String(value).includes(".") ? 1 : 0;
  const display = Number.isFinite(target)
    ? shown.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : value;

  return (
    <div ref={ref} className="text-center">
      <p className="font-display text-4xl font-bold text-slate-900">
        {display}
        {suffix}
      </p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function StatisticsBlock({ content }: Props) {
  const items = list(content, "items");
  if (items.length === 0) return <EmptyHint label="Add a statistic" />;
  return (
    <div className="vd-grid grid gap-6">
      {items.map((item, index) => (
        <Counter key={index} value={itemStr(item, "value")} label={itemStr(item, "label")} />
      ))}
    </div>
  );
}

/* ───────────────────────── lead forms ──────────────────────── */

type FormState = "idle" | "submitting" | "success" | "error";

/**
 * Enquiry / callback / newsletter forms.
 *
 * All three post to the existing `/api/leads` endpoint, so a submission is an
 * ordinary lead with the existing validation, rate limiting and attribution —
 * the builder never gets its own parallel lead store.
 */
export function LeadFormBlock({ content, variant = "full" }: Props & { variant?: "full" | "compact" | "newsletter" }) {
  const [state, setState] = React.useState<FormState>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const compact = variant === "compact" || Boolean(content?.compact);
  const newsletter = variant === "newsletter";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("submitting");
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim() || "Newsletter subscriber",
      phone: String(form.get("phone") || "").trim(),
      email: String(form.get("email") || "").trim(),
      destination: String(form.get("destination") || "").trim(),
      message: String(form.get("message") || "").trim(),
      source: str(content, "source", newsletter ? "newsletter" : "page-form"),
      utm: readClientAttribution(),
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setState("success");
    } catch {
      setError("Network problem — please try again.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-semibold text-emerald-900">
          {str(content, "successMessage", "Thank you! We'll be in touch shortly.")}
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  if (newsletter) {
    return (
      <form onSubmit={onSubmit} className="w-full">
        {str(content, "title") && (
          <h2 className="font-display text-2xl font-bold text-slate-900">{str(content, "title")}</h2>
        )}
        {str(content, "text") && <p className="mt-2 text-slate-600">{str(content, "text")}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className={`${inputClass} flex-1`}
          />
          {/* A newsletter lead still needs a phone number for the CRM's
              validation, so a placeholder is sent rather than shown. */}
          <input type="hidden" name="phone" value="0000000000" />
          <button
            type="submit"
            disabled={state === "submitting"}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {state === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
            {str(content, "buttonLabel", "Subscribe")}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6">
      {str(content, "title") && (
        <h2 className="font-display text-2xl font-bold text-slate-900">{str(content, "title")}</h2>
      )}
      {str(content, "subtitle") && <p className="mt-2 text-sm text-slate-600">{str(content, "subtitle")}</p>}

      <div className="mt-5 grid gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lead-name">
            Your name
          </label>
          <input id="lead-name" name="name" required maxLength={120} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lead-phone">
            Phone
          </label>
          <input id="lead-phone" name="phone" required type="tel" maxLength={20} className={inputClass} />
        </div>

        {!compact && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lead-email">
                Email
              </label>
              <input id="lead-email" name="email" type="email" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lead-destination">
                Where do you want to go?
              </label>
              <input id="lead-destination" name="destination" maxLength={120} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lead-message">
                Anything else?
              </label>
              <textarea id="lead-message" name="message" rows={3} maxLength={2000} className={inputClass} />
            </div>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {state === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
        {str(content, "buttonLabel", "Send enquiry")}
      </button>
    </form>
  );
}

/* ──────────────────────── package search ───────────────────── */

export function PackageSearchBlock({ content }: Props) {
  return (
    <form action="/packages" method="get" className="w-full">
      {str(content, "title") && (
        <h2 className="mb-4 font-display text-2xl font-bold text-slate-900">{str(content, "title")}</h2>
      )}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="sr-only" htmlFor="package-search">
          Search packages
        </label>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="package-search"
            name="q"
            placeholder={str(content, "placeholder", "Where do you want to go?")}
            className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {str(content, "buttonLabel", "Search")}
        </button>
      </div>
    </form>
  );
}

export { num };
