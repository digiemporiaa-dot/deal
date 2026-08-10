"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Faq = { id: string; question: string; answer: string };

export function Faqs({ items }: { items: Faq[] }) {
  const [open, setOpen] = React.useState<string | null>(items[0]?.id ?? null);
  if (items.length === 0) return null;

  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
      {items.map((f) => {
        const isOpen = open === f.id;
        return (
          <div key={f.id}>
            <button
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : f.id)}
            >
              <span className="font-medium text-slate-900">{f.question}</span>
              <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{f.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
