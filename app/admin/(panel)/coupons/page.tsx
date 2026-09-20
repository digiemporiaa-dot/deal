import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { CouponManager } from "@/components/admin/CouponManager";
import { toNumber } from "@/lib/utils";
import type { DiscountType } from "@/types/db-enums";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("coupons:view");

  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <div>
      <PageHeader title="Coupons" description="Create and manage discount codes" />
      <CouponManager
        coupons={coupons.map((c) => ({
          id: c.id, code: c.code, discountType: c.discountType as DiscountType, discountAmount: toNumber(c.discountAmount),
          minAmount: c.minAmount != null ? toNumber(c.minAmount) : null,
          maxDiscount: c.maxDiscount != null ? toNumber(c.maxDiscount) : null,
          expiryDate: c.expiryDate ? c.expiryDate.toISOString() : null,
          usageLimit: c.usageLimit, usedCount: c.usedCount, active: c.active,
        }))}
      />
    </div>
  );
}
