"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useInView, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useReducedMotion } from "motion/react";
import { EASE } from "@/components/motion/settings";
import { cn } from "@/lib/utils";

/**
 * A number that counts up when it scrolls into view.
 *
 * The final value is rendered on the server and kept in the DOM as text, so
 * the real figure is in the HTML for crawlers and for anyone without
 * JavaScript. The animation only replaces what is *displayed*.
 *
 * Counts up once. A statistic that re-runs every time it scrolls past stops
 * being information and becomes a toy.
 */
export function CountUp({
  value,
  suffix = "",
  prefix = "",
  duration = 1.6,
  className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  // Rendered with the real figure, so the server HTML carries the number even
  // if this never animates.
  const [display, setDisplay] = React.useState(value);

  // A ref, not state. Guarding with state would put `started` in the effect's
  // dependencies, so setting it would re-run the effect — and the cleanup
  // from the first run would cancel the animation frame it had just
  // scheduled, leaving the counter frozen at zero.
  const hasRun = React.useRef(false);

  // Drop to zero before the first paint rather than when the counter scrolls
  // into view, so the figure never visibly snaps back to start.
  React.useLayoutEffect(() => {
    if (!reduced) setDisplay(0);
  }, [reduced]);

  React.useEffect(() => {
    if (reduced || !inView || hasRun.current) return;
    hasRun.current = true;

    let frame = 0;
    const start = performance.now();
    const totalMs = duration * 1000;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / totalMs);
      // Ease-out, so the number decelerates into its final value rather than
      // stopping dead on it.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

/**
 * An endless horizontal drift, for a row of destination or category chips.
 *
 * The children are rendered twice and the track is translated by exactly half
 * its width, so the seam lands where the copy begins and the loop is
 * invisible. The duplicate is `aria-hidden`, so a screen reader hears the list
 * once.
 *
 * Pauses on hover — a marquee you cannot stop to read is decoration wearing
 * the costume of navigation. Under reduced motion it does not move at all and
 * becomes an ordinary scrollable row.
 */
export function Marquee({
  children,
  speed = 40,
  className,
  reverse = false,
}: {
  children: React.ReactNode;
  /** Seconds for one full pass. Higher is slower. */
  speed?: number;
  className?: string;
  reverse?: boolean;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className={cn("flex gap-4 overflow-x-auto pb-2", className)}>{children}</div>
    );
  }

  return (
    <div
      className={cn("group relative overflow-hidden", className)}
      // Fades the strip out at both ends so items enter and leave rather than
      // being clipped by a hard edge.
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <m.div
        className="flex w-max gap-4 [animation-play-state:running] group-hover:[animation-play-state:paused]"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
      >
        <div className="flex shrink-0 gap-4">{children}</div>
        <div className="flex shrink-0 gap-4" aria-hidden>
          {children}
        </div>
      </m.div>
    </div>
  );
}

/**
 * A hairline progress bar across the top of the page.
 *
 * Small, and one of the few places motion is genuinely informative rather
 * than decorative: it answers "how much of this is left". Spring-damped so it
 * trails the scroll slightly instead of snapping frame-to-frame.
 */
export function ScrollProgress({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });

  return (
    <m.div
      aria-hidden
      style={{ scaleX }}
      className={cn(
        "fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-brand-500 via-brand-600 to-brand-400",
        className,
      )}
    />
  );
}

/**
 * A soft highlight that follows the pointer across a panel.
 *
 * Used once, on the closing call to action. It is the sort of effect that is
 * lovely in one place and exhausting in six, so it is deliberately not part
 * of the card components.
 */
export function Spotlight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [active, setActive] = React.useState(false);

  const background = useTransform(
    [x, y],
    ([latestX, latestY]: number[]) =>
      `radial-gradient(520px circle at ${latestX}px ${latestY}px, rgba(255,255,255,0.16), transparent 65%)`,
  );

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div
      className={cn("relative", className)}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        x.set(event.clientX - bounds.left);
        y.set(event.clientY - bounds.top);
      }}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
    >
      <m.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background }}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      />
      {children}
    </div>
  );
}
