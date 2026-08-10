import "server-only";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

export type PriceBreakdown = {
  currency: string;
  perPersonPrice: number;
  travellers: number;
  baseAmount: number;
  packageDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  advancePercent: number;
  advanceAmount: number;
  remainingAmount: number;
  couponError?: string;
};

type CalcInput = {
  packageId: string;
  adults: number;
  children: number;
  couponCode?: string | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Authoritative price calculation. ALWAYS runs on the server against DB values;
 * client-submitted amounts are never trusted. Children are billed at 50%.
 */
export async function calculatePrice(input: CalcInput): Promise<PriceBreakdown> {
  const pkg = await prisma.travelPackage.findUnique({
    where: { id: input.packageId },
    select: {
      startingPrice: true,
      discountPrice: true,
      currency: true,
      minTravellers: true,
      maxTravellers: true,
    },
  });
  if (!pkg) throw new Error("Package not found");

  const listPrice = toNumber(pkg.startingPrice);
  const salePrice =
    pkg.discountPrice != null ? toNumber(pkg.discountPrice) : listPrice;
  const perPersonPrice = salePrice;

  const adults = Math.max(1, Math.floor(input.adults || 1));
  const children = Math.max(0, Math.floor(input.children || 0));
  const billableTravellers = adults + children * 0.5;
  const travellers = adults + children;

  const baseAmount = round(listPrice * billableTravellers);
  const afterPackageDiscount = round(perPersonPrice * billableTravellers);
  const packageDiscount = round(baseAmount - afterPackageDiscount);

  // Load settings for tax / advance percentages.
  const settingRow = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  const settings = (settingRow?.data as Record<string, unknown>) ?? {};
  const taxPercent = Number(settings.taxPercent ?? 5);
  const advancePercent = Number(settings.advancePercent ?? 25);

  // Coupon.
  let couponDiscount = 0;
  let couponError: string | undefined;
  let appliedCode: string | null = null;

  if (input.couponCode && input.couponCode.trim()) {
    const code = input.couponCode.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: { packages: { select: { id: true } } },
    });
    const now = new Date();
    if (!coupon || !coupon.active) {
      couponError = "This coupon code is not valid.";
    } else if (coupon.startDate && coupon.startDate > now) {
      couponError = "This coupon is not active yet.";
    } else if (coupon.expiryDate && coupon.expiryDate < now) {
      couponError = "This coupon has expired.";
    } else if (
      coupon.usageLimit != null &&
      coupon.usedCount >= coupon.usageLimit
    ) {
      couponError = "This coupon has reached its usage limit.";
    } else if (
      coupon.minAmount != null &&
      afterPackageDiscount < toNumber(coupon.minAmount)
    ) {
      couponError = `Minimum order of ${toNumber(coupon.minAmount)} required for this coupon.`;
    } else if (
      coupon.packages.length > 0 &&
      !coupon.packages.some((p) => p.id === input.packageId)
    ) {
      couponError = "This coupon does not apply to the selected package.";
    } else {
      couponDiscount = computeCouponDiscount(
        afterPackageDiscount,
        coupon.discountType,
        toNumber(coupon.discountAmount),
        coupon.maxDiscount != null ? toNumber(coupon.maxDiscount) : null,
      );
      appliedCode = code;
    }
  }

  const discountAmount = round(packageDiscount + couponDiscount);
  const taxable = Math.max(0, round(afterPackageDiscount - couponDiscount));
  const taxAmount = round((taxable * taxPercent) / 100);
  const totalAmount = round(taxable + taxAmount);
  const advanceAmount = round((totalAmount * advancePercent) / 100);
  const remainingAmount = round(totalAmount - advanceAmount);

  return {
    currency: pkg.currency,
    perPersonPrice,
    travellers,
    baseAmount,
    packageDiscount,
    couponCode: appliedCode,
    couponDiscount,
    discountAmount,
    taxPercent,
    taxAmount,
    totalAmount,
    advancePercent,
    advanceAmount,
    remainingAmount,
    couponError,
  };
}

function computeCouponDiscount(
  amount: number,
  type: string,
  value: number,
  maxDiscount: number | null,
): number {
  let discount = type === "PERCENTAGE" ? (amount * value) / 100 : value;
  if (maxDiscount != null && maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  discount = Math.min(discount, amount); // never exceed order value
  return round(discount);
}
