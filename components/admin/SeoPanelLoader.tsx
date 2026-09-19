import { getSeoMeta, type SeoEntityType } from "@/lib/seo";
import { SeoPanel, EMPTY_SEO } from "@/components/admin/SeoPanel";
import { can } from "@/lib/guard";

/**
 * Server wrapper that loads a record's saved SEO overrides and hands them to
 * the client panel. Roles without `seo:manage` do not see the panel at all —
 * and `saveSeoPanel` re-checks the permission anyway.
 */
export async function SeoPanelLoader({
  entityType,
  entityId,
  previewPath,
}: {
  entityType: SeoEntityType;
  entityId: string;
  previewPath: string;
}) {
  if (!(await can("seo:manage"))) return null;

  const meta = await getSeoMeta(entityType, entityId);

  return (
    <SeoPanel
      entityType={entityType}
      entityId={entityId}
      previewPath={previewPath}
      initial={
        meta
          ? {
              seoTitle: meta.seoTitle ?? "",
              seoDescription: meta.seoDescription ?? "",
              canonicalUrl: meta.canonicalUrl ?? "",
              focusKeyword: meta.focusKeyword ?? "",
              ogTitle: meta.ogTitle ?? "",
              ogDescription: meta.ogDescription ?? "",
              ogImage: meta.ogImage ?? "",
              twitterTitle: meta.twitterTitle ?? "",
              twitterDescription: meta.twitterDescription ?? "",
              twitterImage: meta.twitterImage ?? "",
              robotsIndex: meta.robotsIndex,
              robotsFollow: meta.robotsFollow,
              schemaType: meta.schemaType ?? "",
              schemaJson: meta.schemaJson ? JSON.stringify(meta.schemaJson, null, 2) : "",
            }
          : EMPTY_SEO
      }
    />
  );
}
