"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, UserRound, FilePlus2, ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";
import { createInvoiceFromQuotation } from "@/app/admin/(panel)/quotations/actions";
import { formatDate } from "@/lib/utils";

/**
 * Where an invoice starts from.
 *
 * Three routes in, because there are three ways a real invoice comes about:
 * a quotation the customer accepted, a customer who is simply being billed,
 * or a one-off typed from scratch. The first is the one that was missing —
 * an accepted quotation had to be retyped as an invoice line by line, which
 * is exactly where a figure gets transposed.
 */

export type AcceptedQuotation = {
  id: string;
  number: string;
  customerName: string;
  title: string | null;
  destination: string | null;
  total: number;
  currency: string;
  createdAt: string;
  leadName: string | null;
};

export type CustomerOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  bookings: number;
};

export function InvoiceSourcePicker({
  quotations,
  customers,
}: {
  quotations: AcceptedQuotation[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = React.useState<"quotation" | "customer" | "blank">(
    quotations.length > 0 ? "quotation" : "customer",
  );
  const [pending, setPending] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const convert = async (id: string) => {
    setPending(id);
    const result = await createInvoiceFromQuotation(id);
    if (result.ok) {
      toast.success(`Invoice ${result.number} created from the quotation.`);
      router.push(`/admin/invoices/${result.id}`);
    } else {
      toast.error(result.error);
      setPending(null);
    }
  };

  const money = (value: number, currency: string) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

  const needle = query.trim().toLowerCase();
  const shownQuotations = needle
    ? quotations.filter((q) =>
        [q.number, q.customerName, q.title, q.destination, q.leadName]
          .some((f) => (f ?? "").toLowerCase().includes(needle)),
      )
    : quotations;
  const shownCustomers = needle
    ? customers.filter((c) =>
        [c.name, c.email, c.phone].some((f) => (f ?? "").toLowerCase().includes(needle)),
      )
    : customers;

  return (
    <div className="rounded-2xl border border-admin bg-white">
      <div className="flex flex-wrap gap-1 border-b border-admin p-2">
        <TabButton active={tab === "quotation"} onClick={() => setTab("quotation")}>
          <FileSpreadsheet className="h-4 w-4" /> From an accepted quotation
          <Count n={quotations.length} />
        </TabButton>
        <TabButton active={tab === "customer"} onClick={() => setTab("customer")}>
          <UserRound className="h-4 w-4" /> For a customer
        </TabButton>
        <TabButton active={tab === "blank"} onClick={() => setTab("blank")}>
          <FilePlus2 className="h-4 w-4" /> Start blank
        </TabButton>
      </div>

      {tab !== "blank" && (
        <div className="border-b border-admin p-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "quotation" ? "Search quotations…" : "Search customers…"}
            className="h-10 w-full rounded-lg border border-admin-border-strong px-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      )}

      <div className="p-3">
        {tab === "quotation" && (
          quotations.length === 0 ? (
            <Empty
              title="No accepted quotations"
              body="A quotation shows up here once it is marked Accepted. Until then there is nothing agreed to invoice."
            />
          ) : shownQuotations.length === 0 ? (
            <Empty title="Nothing matches that" body="Try a different name or number." />
          ) : (
            <ul className="space-y-2">
              {shownQuotations.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-admin px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-admin-text">
                      {q.number}
                      <StatusBadge tone="green">Accepted</StatusBadge>
                    </p>
                    <p className="truncate text-sm text-admin-text-muted">
                      {q.customerName}
                      {q.title ? ` · ${q.title}` : q.destination ? ` · ${q.destination}` : ""}
                    </p>
                    <p className="text-xs text-admin-text-subtle">
                      {formatDate(q.createdAt)}
                      {q.leadName ? ` · from lead ${q.leadName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-admin-text">
                      {money(q.total, q.currency)}
                    </span>
                    <button
                      type="button"
                      disabled={pending !== null}
                      onClick={() => void convert(q.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {pending === q.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      {pending === q.id ? "Creating…" : "Create invoice"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "customer" && (
          customers.length === 0 ? (
            <Empty title="No customers yet" body="Customers appear once someone has booked." />
          ) : shownCustomers.length === 0 ? (
            <Empty title="Nothing matches that" body="Try a different name, email or phone." />
          ) : (
            <ul className="space-y-2">
              {shownCustomers.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/invoices/new?customerId=${encodeURIComponent(c.id)}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-admin px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-admin-text">{c.name}</p>
                      <p className="truncate text-xs text-admin-text-muted">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                    </div>
                    <span className="text-xs text-admin-text-muted">
                      {c.bookings} {c.bookings === 1 ? "trip" : "trips"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "blank" && (
          <div className="px-1 py-2">
            <p className="text-sm text-admin-text-muted">
              An empty invoice you fill in yourself. Use this for something that never had a
              quotation behind it.
            </p>
            <Link
              href="/admin/invoices/new?blank=1"
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <FilePlus2 className="h-4 w-4" /> Start a blank invoice
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700"
          : "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-admin-text-muted hover:bg-admin-muted"
      }
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="rounded-full bg-white/70 px-1.5 text-[10px] tabular-nums text-brand-700">
      {n}
    </span>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-admin-border-strong px-4 py-10 text-center">
      <p className="font-medium text-admin-text">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-admin-text-muted">{body}</p>
    </div>
  );
}
