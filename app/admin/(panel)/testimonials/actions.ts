"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { testimonialSchema, type TestimonialInput } from "@/lib/validation";

export async function saveTestimonial(input: TestimonialInput, id?: string) {
  const guard = await guardAction("testimonials:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };
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
  try {
    const saved = id
      ? await prisma.testimonial.update({ where: { id }, data })
      : await prisma.testimonial.create({ data });

    await recordActivity({
      actor: guard.actor,
      action: id ? "UPDATE" : "CREATE",
      entity: "Testimonial",
      entityId: saved.id,
      description: `${id ? "Updated" : "Created"} testimonial from ${d.customerName}`,
      metadata: { rating: d.rating, published: d.published },
    });

    revalidatePath("/admin/testimonials");
    revalidatePath("/");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.saveTestimonial", { id }).message };
  }
}

export async function deleteTestimonial(id: string) {
  const guard = await guardAction("testimonials:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  try {
    const removed = await prisma.testimonial.delete({ where: { id } });
    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "Testimonial",
      entityId: id,
      description: `Deleted testimonial from ${removed.customerName}`,
    });
    revalidatePath("/admin/testimonials");
    revalidatePath("/");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.deleteTestimonial", { id }).message };
  }
}

export async function toggleTestimonial(id: string) {
  const guard = await guardAction("testimonials:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const t = await prisma.testimonial.findUnique({
    where: { id },
    select: { published: true, customerName: true },
  });
  if (!t) return { ok: false as const, error: "Not found" };

  await prisma.testimonial.update({ where: { id }, data: { published: !t.published } });
  await recordActivity({
    actor: guard.actor,
    action: "STATUS_CHANGE",
    entity: "Testimonial",
    entityId: id,
    description: `${t.published ? "Hid" : "Published"} testimonial from ${t.customerName}`,
    metadata: { published: { from: t.published, to: !t.published } },
  });
  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  return { ok: true as const };
}
