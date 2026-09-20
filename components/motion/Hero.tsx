"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "motion/react";
import { DURATION, EASE, transition } from "@/components/motion/settings";
import { cn } from "@/lib/utils";

/**
 * Hero motion.
 *
 * Three layers, which is what separates an expensive hero from a stock one:
 *
 *  1. The photograph drifts — a very slow scale from 1.0 to ~1.08 over 20
 *     seconds. Long enough that nobody catches it moving; short enough that
 *     the frame is never quite static.
 *  2. It also parallaxes on scroll, at roughly a third of the page's speed,
 *     so the foreground text appears to sit in front of a deeper scene.
 *  3. The copy arrives in sequence — badge, headline, sub, buttons — rather
 *     than as one block.
 *
 * All three stop entirely under `prefers-reduced-motion`: a drifting
 * background is exactly the kind of persistent movement that setting exists
 * to switch off, and unlike a one-shot reveal it never ends on its own.
 */

/** The image layer. Wraps a server-rendered <Image> so the LCP stays priority-loaded. */
export function HeroBackdrop({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  // `offset` measures from "the top of this element hits the bottom of the
  // viewport" to "its bottom hits the top", so progress is 0→1 across exactly
  // the span where the hero is visible.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // A third of scroll speed. More than that and the image visibly detaches
  // from the text sitting on it.
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.45]);

  if (reduced) {
    return (
      <div ref={ref} className={cn("absolute inset-0 -z-10", className)}>
        {children}
      </div>
    );
  }

  return (
    <m.div ref={ref} style={{ y, opacity }} className={cn("absolute inset-0 -z-10", className)}>
      <m.div
        className="h-full w-full"
        initial={{ scale: 1.02 }}
        animate={{ scale: 1.1 }}
        transition={{ duration: 20, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      >
        {children}
      </m.div>
    </m.div>
  );
}

/**
 * The copy layer.
 *
 * Runs on mount rather than on scroll — the hero is already in view, and
 * waiting for an intersection callback would show a blank hero for a frame.
 */
export function HeroIntro({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        // A beat before anything moves, so the first thing a visitor sees is
        // the photograph rather than text already in flight.
        visible: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
      }}
    >
      {children}
    </m.div>
  );
}

/** One line of hero copy. Rises further than a normal reveal, and slower. */
export function HeroLine({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "h1" | "p" | "span";
}) {
  const Component = m[as];

  return (
    <Component
      data-motion
      className={className}
      variants={{
        hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
        visible: {
          opacity: 1,
          y: 0,
          // The blur resolving is what makes text feel like it is settling
          // into focus rather than sliding in from off-screen.
          filter: "blur(0px)",
          transition: { duration: DURATION.entrance, ease: EASE },
        },
      }}
    >
      {children}
    </Component>
  );
}

/**
 * A quiet "scroll" cue at the foot of the hero.
 *
 * Hidden from assistive technology: it is decoration, and a screen reader
 * announcing "scroll indicator" helps nobody.
 */
export function ScrollCue({ label = "Scroll" }: { label?: string }) {
  const reduced = useReducedMotion();

  return (
    <m.div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 text-white/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition(DURATION.reveal, 1.2)}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.2em]">{label}</span>
      <span className="relative h-9 w-[1px] overflow-hidden bg-white/25">
        {!reduced && (
          <m.span
            className="absolute inset-x-0 top-0 block h-3 bg-white/80"
            animate={{ y: [-12, 36] }}
            transition={{ duration: 2.2, ease: EASE, repeat: Infinity, repeatDelay: 0.4 }}
          />
        )}
      </span>
    </m.div>
  );
}
