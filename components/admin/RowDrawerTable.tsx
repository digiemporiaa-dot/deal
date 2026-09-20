"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

/**
 * Keeps "which row is open" in the URL, without a server round-trip.
 *
 * Three tables open a preview drawer on row click and all want the same
 * behaviour, so the logic lives here once rather than being copied into each.
 *
 * The open id is held in React state and mirrored into the address bar with
 * the native history API. That matters: routing through `router.replace`
 * would re-run the page on the server and the drawer could not appear until
 * that returned — a visible delay for a panel whose whole point is to be
 * quicker than navigating, and a dead click if the request is superseded.
 * Nothing about the list changes when a preview opens, so re-rendering it
 * server-side buys nothing.
 *
 * Opening pushes a history entry so Back closes the drawer; closing replaces
 * it, so repeatedly opening and closing does not fill the history.
 */
export function useRowDrawer(param: string) {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get(param);

  const [openId, setOpenId] = React.useState<string | null>(fromUrl);

  // What this hook last wrote to the address bar. `useSearchParams` does not
  // always reflect a native history write, so the sync below has to tell
  // "the URL changed under us" apart from "we changed it".
  const written = React.useRef<string | null>(fromUrl);

  React.useEffect(() => {
    if (fromUrl !== written.current) {
      written.current = fromUrl;
      setOpenId(fromUrl);
    }
  }, [fromUrl]);

  // Back and Forward move between "open" and "closed".
  React.useEffect(() => {
    const onPopState = () => {
      const current = new URLSearchParams(window.location.search).get(param);
      written.current = current;
      setOpenId(current);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [param]);

  const open = React.useCallback(
    (id: string | null) => {
      setOpenId(id);
      written.current = id;

      const url = new URL(window.location.href);
      if (id) url.searchParams.set(param, id);
      else url.searchParams.delete(param);

      // Opening is a place you can come back from; closing is not.
      if (id) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [param],
  );

  return { openId, setOpenId: open };
}
