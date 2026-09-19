import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/guard";
import { toSafeError, AppError } from "@/lib/errors";
import { searchCatalogue } from "@/lib/builder/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  resource: z.enum(["package", "destination", "blog"]),
  q: z.string().trim().max(120).default(""),
});

/**
 * Options for the builder's "choose specific items" pickers.
 *
 * Admin-only, and it returns nothing but ids and labels — the picker needs no
 * more than that, so no draft copy or pricing leaks through it.
 */
export async function GET(request: Request) {
  try {
    await requirePermission("pages:update");

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid search request.");

    const results = await searchCatalogue(parsed.data.resource, parsed.data.q);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const safe = toSafeError(error, "api.builder.search");
    return NextResponse.json({ ok: false, error: safe.message }, { status: safe.status });
  }
}
