import { themeCss, googleFontHref } from "@/lib/theme";

/**
 * Applies the admin's appearance settings to the public site.
 *
 * Emitted in the public layout, so it overrides the defaults in globals.css
 * for public pages and leaves the admin panel on its own palette. It is a
 * server component: the CSS is built during the render that produces the
 * page, so the first paint is already the right colour — no flash of the
 * default brand, and nothing to hydrate.
 *
 * `themeCss` builds every declaration from parsed numbers and its own tables,
 * which is what makes putting it in a <style> element safe; see lib/theme.ts.
 */
export function ThemeStyle({ theme }: { theme: unknown }) {
  const css = themeCss(theme);
  const fontHref = googleFontHref(theme);

  return (
    <>
      {fontHref && (
        <>
          {/* Warming the connection first: the stylesheet request otherwise
              pays DNS, TCP and TLS before a single glyph is asked for. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={fontHref} />
        </>
      )}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
