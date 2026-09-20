"use client";

import { LazyMotion, domAnimation, MotionConfig } from "motion/react";
import { useReducedMotion } from "motion/react";

/**
 * Motion runtime for the public site.
 *
 * Two deliberate decisions keep this off the critical path:
 *
 *  - `LazyMotion` with `domAnimation` ships the transform and opacity feature
 *    set rather than the whole library — roughly a third of it. (A lazily
 *    imported loader was measured here too and made the route's reported
 *    first-load *larger*, because the async chunk is still attributed to it,
 *    so the static import wins on the metric that matters.)
 *  - `strict` rejects `motion.div` anywhere below, so the full library cannot
 *    be pulled back into the initial bundle by someone reaching for the more
 *    familiar import. Every component here uses `m.*`.
 *
 * `reducedMotion="user"` is the accessibility contract: when the operating
 * system asks for reduced motion, transforms become instant cuts while
 * opacity still cross-fades. That is what the setting asks for — not "no
 * feedback", but "nothing travelling across the screen".
 */

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Re-exported so feature components do not each import from the library. */
export { useReducedMotion };
