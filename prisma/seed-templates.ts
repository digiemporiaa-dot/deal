import { Prisma, PrismaClient } from "@prisma/client";
import { builtInTemplates } from "../lib/builder/builtin-templates";
import { validateDocument } from "../lib/builder/schema";

/**
 * Seed the built-in template library.
 *
 * Idempotent: every template is matched on its slug and upserted, so running
 * this again after a deploy refreshes the shipped templates without touching
 * anything an admin saved themselves (those have `isBuiltIn: false`).
 *
 * Nothing is ever deleted here — a built-in template an admin has edited or
 * a template removed from a later release simply stays in the library.
 *
 *   npm run db:seed-templates
 */

const prisma = new PrismaClient();

async function main() {
  const templates = builtInTemplates();
  let created = 0;
  let updated = 0;

  for (const template of templates) {
    // Validate before writing: a typo in a shipped template should fail the
    // seed loudly rather than land in the database and render as an empty page.
    const check = validateDocument(template.content);
    if (!check.ok) {
      throw new Error(`Built-in template "${template.slug}" is invalid: ${check.error}`);
    }

    // Prisma types a Json column as an index-signature object; a typed
    // document is structurally fine but does not satisfy that signature.
    const content = check.document as unknown as Prisma.InputJsonValue;

    const existing = await prisma.pageTemplate.findUnique({
      where: { slug: template.slug },
      select: { id: true, isBuiltIn: true },
    });

    if (existing && !existing.isBuiltIn) {
      console.log(`↷ skipped "${template.slug}" — an admin template already owns that slug`);
      continue;
    }

    await prisma.pageTemplate.upsert({
      where: { slug: template.slug },
      create: {
        name: template.name,
        slug: template.slug,
        description: template.description,
        kind: template.kind,
        category: template.category,
        content,
        isBuiltIn: true,
      },
      update: {
        name: template.name,
        description: template.description,
        kind: template.kind,
        category: template.category,
        content,
        isBuiltIn: true,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`✅ Templates seeded — ${created} created, ${updated} refreshed.`);
}

main()
  .catch((error) => {
    console.error("❌ Template seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
