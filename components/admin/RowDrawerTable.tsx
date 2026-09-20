"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Keeps "which row is open" in the URL.
 *
 * Both the bookings and customers tables open a drawer on row click, and both
 * want the same behaviour: Back closes it, and the address can be shared or
 * linked to from search. That logic is identical in each, so it lives here
 * once rather than being copied into both tables.
 */
export function useRowDrawer(param: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openId = searchParams.get(param);

  const setOpenId = React.useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set(param, id);
      else params.delete(param);
      const query = params.toString();
      // `replace` rather than `push`: opening and closing a preview should not
      // fill the history with entries for the same list.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [param, pathname, router, searchParams],
  );

  return { openId, setOpenId };
}
