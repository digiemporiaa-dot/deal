import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/guard";
import { hasPermission, isLeadOwnerOnly, canAssignLeads } from "@/lib/permissions";
import { toSafeError } from "@/lib/errors";

/**
 * One lead, for the detail drawer.
 *
 * The drawer opens over the list rather than navigating, so it needs its own
 * fetch. Every check the full lead page makes is repeated here — an owner-only
 * role gets a 404 for someone else's lead, exactly as the page gives them —
 * because a route handler is directly reachable and cannot lean on the UI
 * having hidden the link.
 */

export type LeadDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  destination: string | null;
  travelDate: string | null;
  returnDate: string | null;
  travellers: number | null;
  adults: number | null;
  children: number | null;
  budget: string | null;
  message: string | null;
  country: string | null;
  source: string;
  campaign: string | null;
  medium: string | null;
  landingPage: string | null;
  status: string;
  priority: string;
  createdAt: string;
  nextFollowUpAt: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  notes: {
    id: string;
    type: string;
    body: string;
    subject: string | null;
    createdAt: string;
    author: string | null;
  }[];
  /**
   * Quotations and invoices raised for this lead.
   *
   * The drawer is where a lead is worked, so the money side of it has to be
   * visible from there. It was only on the full record page, which meant the
   * quickest way to quote a customer was to leave the screen you were on.
   */
  documents: {
    id: string;
    kind: string;
    number: string;
    status: string;
    title: string | null;
    createdAt: string;
  }[];
  members: { id: string; name: string; role: string }[];
  /** What this user may do, so the drawer does not offer a disabled control. */
  can: { update: boolean; assign: boolean; delete: boolean; documents: boolean };
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await currentUser();

  if (!actor || !hasPermission(actor.role, "leads:view")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { author: { select: { name: true } } },
        },
        assignedTo: { select: { id: true, name: true } },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, kind: true, number: true, status: true, title: true, createdAt: true },
        },
      },
    });

    // Not found and not yours are the same answer: a different message would
    // confirm the lead exists.
    if (!lead || (isLeadOwnerOnly(actor.role) && lead.assignedToId !== actor.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const mayAssign = canAssignLeads(actor.role);

    const members = mayAssign
      ? await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : [];

    const detail: LeadDetail = {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      destination: lead.destination,
      travelDate: lead.travelDate?.toISOString() ?? null,
      returnDate: lead.returnDate?.toISOString() ?? null,
      travellers: lead.travellers,
      adults: lead.adults,
      children: lead.children,
      budget: lead.budget,
      message: lead.message,
      country: lead.country,
      source: lead.source,
      campaign: lead.campaign,
      medium: lead.medium,
      landingPage: lead.landingPage,
      status: lead.status,
      priority: lead.priority,
      createdAt: lead.createdAt.toISOString(),
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
      assignedToId: lead.assignedToId,
      assignedToName: lead.assignedTo?.name ?? null,
      notes: lead.notes.map((note) => ({
        id: note.id,
        type: note.type,
        body: note.body,
        subject: note.subject,
        createdAt: note.createdAt.toISOString(),
        author: note.author?.name ?? null,
      })),
      members,
      documents: lead.documents.map((doc) => ({
        id: doc.id,
        kind: doc.kind,
        number: doc.number,
        status: doc.status,
        title: doc.title,
        createdAt: doc.createdAt.toISOString(),
      })),
      can: {
        update: hasPermission(actor.role, "leads:update"),
        assign: mayAssign,
        delete: hasPermission(actor.role, "leads:delete"),
        documents: hasPermission(actor.role, "documents:create"),
      },
    };

    return NextResponse.json(detail);
  } catch (error) {
    const safe = toSafeError(error, "api.leadDetail", { leadId: id });
    return NextResponse.json({ error: safe.message }, { status: 500 });
  }
}
