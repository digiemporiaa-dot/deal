"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { couponSchema, type CouponInput } from "@/lib/validation";

export async function saveCoupon(input: CouponInput, id?: string) {
  try { await requireAdmin(); } catch { return { ok: false as const, error: "Not authorized" }; }
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
    revalidatePath("/admin/coupons");
    return { ok: true as const };
  } catch (err) {
    console.error("[saveCoupon]", err);
    return { ok: false as const, error: "Could not save coupon (code may already exist)." };
  }
}

export async function deleteCoupon(id: string) {
  try { await requireAdmin(); } catch { return { ok: false as const, error: "Not authorized" }; }
  await prisma.coupon.delete({ where: { id } });
  revalidatePath("/admin/coupons");
  return { ok: true as const };
}
