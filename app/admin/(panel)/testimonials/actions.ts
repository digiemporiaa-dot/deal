"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { testimonialSchema, type TestimonialInput } from "@/lib/validation";

export async function saveTestimonial(input: TestimonialInput, id?: string) {
  try { await requireAdmin(); } catch { return { ok: false as const, error: "Not authorized" }; }
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please check the form.", issues: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const data = {
    customerName: d.customerName,
    image: d.image || null,
    rating: d.rating,
    review: d.review,
    packageId: d.packageId || null,
    destination: d.destination || null,
    published: d.published,
  };
  if (id) await prisma.testimonial.update({ where: { id }, data });
  else await prisma.testimonial.create({ data });
  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteTestimonial(id: string) {
  try { await requireAdmin(); } catch { return { ok: false as const, error: "Not authorized" }; }
  await prisma.testimonial.delete({ where: { id } });
  revalidatePath("/admin/testimonials");
  return { ok: true as const };
}

export async function toggleTestimonial(id: string) {
  try { await requireAdmin(); } catch { return { ok: false as const, error: "Not authorized" }; }
  const t = await prisma.testimonial.findUnique({ where: { id }, select: { published: true } });
  if (!t) return { ok: false as const, error: "Not found" };
  await prisma.testimonial.update({ where: { id }, data: { published: !t.published } });
  revalidatePath("/admin/testimonials");
  return { ok: true as const };
}
