import { NextResponse } from "next/server";
import { z } from "zod";
import { calculatePrice } from "@/lib/pricing";

const quoteSchema = z.object({
  packageId: z.string().min(1),
  adults: z.coerce.number().int().min(1).max(50),
  children: z.coerce.number().int().min(0).max(50).default(0),
  couponCode: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 422 });
  }

  try {
    const price = await calculatePrice(parsed.data);
    return NextResponse.json({ ok: true, price });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not calculate price" }, { status: 500 });
  }
}
