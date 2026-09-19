"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { couponSchema, type CouponInput } from "@/lib/validation";

export async function saveCoupon(input: CouponInput, id?: string) {
  const guard = await guardAction("coupons:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please check the form.", issues: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const base = {
    code: d.code,
    discountType: d.discountType,
    discountAmount: d.discountAmount,
    minAmount: d.minAmount ?? null,
    maxDiscount: d.maxDiscount ?? null,
    startDate: d.startDate ? new Date(d.startDate) : null,
    expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
    usageLimit: d.usageLimit ?? null,
    active: d.active,
  };
  const packageConnect = d.packageIds.map((pid) => ({ id: pid }));

  try {
    if (id) {
      await prisma.coupon.update({
        where: { id },
        data: { ...base, packages: { set: packageConnect } },
      });
    } else {
      await prisma.coupon.create({
        data: { ...base, packages: { connect: packageConnect } },
      });
    }
    await recordActivity({
      actor: guard.actor,
      action: id ? "UPDATE" : "CREATE",
      entity: "Coupon",
      entityId: id ?? null,
      description: `${id ? "Updated" : "Created"} coupon ${d.code}`,
      metadata: { discountType: d.discountType, discountAmount: d.discountAmount, active: d.active },
    });

    revalidatePath("/admin/coupons");
    return { ok: true as const };
  } catch (err) {
    toSafeError(err, "action.saveCoupon", { id });
    return { ok: false as const, error: "Could not save coupon (the code may already exist)." };
  }
}

export async function deleteCoupon(id: string) {
  const guard = await guardAction("coupons:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  try {
    const coupon = await prisma.coupon.delete({ where: { id } });
    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "Coupon",
      entityId: id,
      description: `Deleted coupon ${coupon.code}`,
    });
    revalidatePath("/admin/coupons");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.deleteCoupon", { id }).message };
  }
}
