"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendMail } from "@/lib/email/mailer";
import { getSettings } from "@/lib/settings";
import { documentEmail } from "@/lib/email/document-email";
import {
  computeTotals,
  nextDocumentNumber,
  DOC_LABEL,
  DOC_STATUSES,
  type DocKind,
} from "@/lib/documents";

const itemSchema = z.object({
  title: z.string().trim().min(1, "Item name is required"),
  description: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().min(0).max(100_000_000),
});

const docSchema = z.object({
  kind: z.enum(["QUOTATION", "INVOICE"]),
  status: z.string().trim().min(1),
  leadId: z.string().trim().optional().nullable(),
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerEmail: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  customerPhone: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
  destination: z.string().trim().optional().nullable(),
  travelDate: z.string().trim().optional().nullable(),
  travellers: z.coerce.number().int().min(0).max(999).optional().nullable(),
  validUntil: z.string().trim().optional().nullable(),
  dueDate: z.string().trim().optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  amountPaid: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional().nullable(),
  terms: z.string().trim().optional().nullable(),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});

export type DocumentInput = z.input<typeof docSchema>;
export type DocResult = { ok: true; id: string; number: string } | { ok: false; error: string };

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveDocument(input: DocumentInput, id?: string): Promise<DocResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized" };

  const parsed = docSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Please check the form" };
  }
  const d = parsed.data;

  if (!DOC_STATUSES[d.kind as DocKind].includes(d.status)) {
    return { ok: false, error: "Invalid status for this document" };
  }

  const base = {
    kind: d.kind,
    status: d.status,
    leadId: d.leadId || null,
    customerName: d.customerName,
    customerEmail: d.customerEmail || null,
    customerPhone: d.customerPhone || null,
    billingAddress: d.billingAddress || null,
    title: d.title || null,
    destination: d.destination || null,
    travelDate: toDate(d.travelDate),
    travellers: d.travellers ?? null,
    validUntil: toDate(d.validUntil),
    dueDate: toDate(d.dueDate),
    discount: d.discount,
    taxPercent: d.taxPercent,
    amountPaid: d.amountPaid,
    notes: d.notes || null,
    terms: d.terms || null,
  };

  const items = d.items.map((it, index) => ({
    title: it.title,
    description: it.description || null,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    sortOrder: index,
  }));

  let saved;
  if (id) {
    await prisma.salesDocumentItem.deleteMany({ where: { documentId: id } });
    saved = await prisma.salesDocument.update({
      where: { id },
      data: { ...base, items: { create: items } },
    });
  } else {
    saved = await prisma.salesDocument.create({
      data: {
        ...base,
        number: await nextDocumentNumber(d.kind as DocKind),
        createdById: session.user.id,
        items: { create: items },
      },
    });
  }

  const route = DOC_LABEL[d.kind as DocKind].route;
  revalidatePath(`/admin/${route}`);
  revalidatePath(`/admin/${route}/${saved.id}`);
  return { ok: true, id: saved.id, number: saved.number };
}

export async function updateDocumentStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };

  const doc = await prisma.salesDocument.findUnique({ where: { id }, select: { kind: true } });
  if (!doc) return { ok: false as const, error: "Document not found" };
  if (!DOC_STATUSES[doc.kind as DocKind].includes(status)) {
    return { ok: false as const, error: "Invalid status" };
  }

  await prisma.salesDocument.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/${DOC_LABEL[doc.kind as DocKind].route}`);
  return { ok: true as const };
}

export async function recordPayment(id: string, amount: number) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };
  if (!(amount > 0)) return { ok: false as const, error: "Enter an amount greater than zero" };

  const doc = await prisma.salesDocument.findUnique({ where: { id }, include: { items: true } });
  if (!doc) return { ok: false as const, error: "Document not found" };

  const paidSoFar = Number(doc.amountPaid) + amount;
  const totals = computeTotals(
    doc.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    { discount: Number(doc.discount), taxPercent: Number(doc.taxPercent), amountPaid: paidSoFar },
  );

  await prisma.salesDocument.update({
    where: { id },
    data: {
      amountPaid: paidSoFar,
      status: totals.balance <= 0 ? "PAID" : "PARTIAL",
    },
  });

  revalidatePath(`/admin/invoices`);
  revalidatePath(`/admin/invoices/${id}`);
  return { ok: true as const };
}

export async function emailDocument(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };

  const doc = await prisma.salesDocument.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!doc) return { ok: false as const, error: "Document not found" };
  if (!doc.customerEmail) return { ok: false as const, error: "This customer has no email address" };

  const settings = await getSettings();
  const kind = doc.kind as DocKind;
  const totals = computeTotals(
    doc.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    { discount: Number(doc.discount), taxPercent: Number(doc.taxPercent), amountPaid: Number(doc.amountPaid) },
  );
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://vacation-deal.vercel.app";

  const delivered = await sendMail({
    to: doc.customerEmail,
    subject: `${DOC_LABEL[kind].one} ${doc.number} from ${settings.siteName}`,
    html: documentEmail({
      siteName: settings.siteName,
      kindLabel: DOC_LABEL[kind].one,
      number: doc.number,
      customerName: doc.customerName,
      title: doc.title,
      items: doc.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
      totals,
      currency: doc.currency,
      validUntil: doc.validUntil,
      dueDate: doc.dueDate,
      notes: doc.notes,
      terms: doc.terms,
      phone: settings.phone || null,
      whatsapp: settings.whatsapp || null,
      viewUrl: `${base}/admin/${DOC_LABEL[kind].route}/${doc.id}/print`,
    }),
    replyTo: process.env.ADMIN_NOTIFY_EMAIL || undefined,
  });

  if (delivered && doc.status === "DRAFT") {
    await prisma.salesDocument.update({ where: { id }, data: { status: "SENT" } });
  }

  // Keep the lead's timeline honest — the customer received a document.
  if (doc.leadId) {
    await prisma.leadNote.create({
      data: {
        leadId: doc.leadId,
        type: "EMAIL",
        authorId: session.user.id,
        subject: `${DOC_LABEL[kind].one} ${doc.number} sent`,
        emailTo: doc.customerEmail,
        delivered,
        body: `${DOC_LABEL[kind].one} ${doc.number} for ${totals.total.toLocaleString("en-IN")} was emailed to the customer.`,
      },
    });
    revalidatePath(`/admin/leads/${doc.leadId}`);
  }

  revalidatePath(`/admin/${DOC_LABEL[kind].route}`);
  return delivered
    ? { ok: true as const }
    : { ok: false as const, error: "Email could not be sent — check the SMTP settings in Vercel." };
}

export async function deleteDocument(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };

  const doc = await prisma.salesDocument.findUnique({ where: { id }, select: { kind: true } });
  await prisma.salesDocument.delete({ where: { id } });
  if (doc) revalidatePath(`/admin/${DOC_LABEL[doc.kind as DocKind].route}`);
  return { ok: true as const };
}

/** Prefill a new document straight from a lead. */
export async function createDocumentFromLead(leadId: string, kind: DocKind): Promise<DocResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized" };

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "Lead not found" };

  const doc = await prisma.salesDocument.create({
    data: {
      kind,
      number: await nextDocumentNumber(kind),
      status: "DRAFT",
      leadId: lead.id,
      createdById: session.user.id,
      customerName: lead.name,
      customerEmail: lead.email,
      customerPhone: lead.phone,
      destination: lead.destination,
      travelDate: lead.travelDate,
      travellers: lead.travellers,
      title: lead.destination ? `Holiday package — ${lead.destination}` : "Holiday package",
      items: {
        create: [
          {
            title: lead.destination ? `${lead.destination} tour package` : "Tour package",
            description: "Accommodation, transfers and sightseeing",
            quantity: lead.travellers || 1,
            unitPrice: 0,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  revalidatePath(`/admin/${DOC_LABEL[kind].route}`);
  return { ok: true, id: doc.id, number: doc.number };
}
