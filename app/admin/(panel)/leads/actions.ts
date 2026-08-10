"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth, requireAdmin } from "@/lib/auth";
import type { LeadStatus } from "@/types/db-enums";

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"];

export async function updateLeadStatus(id: string, status: string) {
  await requireAdmin();
  if (!STATUSES.includes(status as LeadStatus)) return { ok: false as const, error: "Invalid status" };
  await prisma.lead.update({ where: { id }, data: { status: status as LeadStatus } });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  return { ok: true as const };
}

export async function addLeadNote(leadId: string, body: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };
  if (!body.trim()) return { ok: false as const, error: "Note cannot be empty" };
  await prisma.leadNote.create({ data: { leadId, body: body.trim(), authorId: session.user.id } });
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

export async function deleteLead(id: string) {
  await requireAdmin();
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/admin/leads");
  return { ok: true as const };
}
