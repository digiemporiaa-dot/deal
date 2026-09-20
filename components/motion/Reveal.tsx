"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useInView } from "motion/react";
import { IN_VIEW, riseVariants, staggerVariants, transition, DURATION } from "@/components/motion/settings";
import { cn } from "@/lib/utils";

/**
 * Scroll reveals.
 *
 * These wrap server-rendered children rather than replacing them: the markup
 * inside is still produced on the server, so the page's HTML — and everything
 * a crawler or a reader-mode parser sees — is unchanged. Only the wrapper is
 * a client component.
 *
 * `data-motion` marks every element whose starting state is "invisible". A
 * `<noscript>` rule in the layout resets those to fully visible, so a visitor
 * without JavaScript gets the page rather than an empty screen.
 */

/**
 * Should this element be showing?
 *
 * `whileInView` alone is not enough. An IntersectionObserver only reports
 * elements that *enter* the viewport, so anything already scrolled past when
 * it mounts never fires and stays invisible for good. That is not a hypothetical:
 * it is what happens every time a browser restores the scroll position on
 * reload, or a visitor follows an anchor link into the middle of the page —
 * they scroll back up to blank space.
 *
 * So as well as watching for entry, this measures once on mount and shows
 * anything that is already above the fold.
 */
function useRevealed(once: boolean) {
  const ref = React.useRef<HTMLElement | null>(null);
  const inView = useInView(ref as React.RefObject<HTMLElement>, { ...IN_VIEW, once });
  const [alreadyPassed, setAlreadyPassed] = React.useState(false);

  // A callback ref rather than the object: these components render one of
  // several element types, so the ref has to satisfy every one of them, and a
  // callback taking the common supertype does while a RefObject of one
  // concrete type does not.
  const setRef = React.useCallback((node: HTMLElement | null) => {
    ref.current = node;
  }, []);

  // Layout effect, so the correction lands before the browser paints and
  // there is no flash of hidden content.
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.getBoundingClientRect().bottom <= 0) {
      setAlreadyPassed(true);
    }
  }, []);

  return { ref: setRef, show: inView || alreadyPassed, instant: alreadyPassed };
}

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds to wait after this element enters view. */
  delay?: number;
  /** `false` re-animates every time it scrolls back into view. Rarely wanted. */
  once?: boolean;
  as?: "div" | "section" | "li" | "span";
};

export function Reveal({ children, className, delay = 0, once = true, as = "div" }: RevealProps) {
  const Component = m[as];
  const { ref, show, instant } = useRevealed(once);

  return (
    <Component
      ref={ref}
      data-motion
      className={className}
      initial="hidden"
      animate={show ? "visible" : "hidden"}
      variants={{
        hidden: riseVariants.hidden,
        visible: {
          ...(riseVariants.visible as object),
          // Content the visitor has already scrolled past should simply be
          // there — animating it in behind their back is worse than nothing.
          transition: instant ? { duration: 0 } : transition(DURATION.reveal, delay),
        },
      }}
    >
      {children}
    </Component>
  );
}

/**
 * A container whose children arrive one after another.
 *
 * Pair with `StaggerItem`. The children must be `StaggerItem`s (or any motion
 * element with `hidden`/`visible` variants) — a plain element inside will
 * simply not animate, which is the safe failure.
 */
export function Stagger({
  children,
  className,
  stagger = 0.07,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: "div" | "section" | "ul";
}) {
  const Component = m[as];
  const { ref, show, instant } = useRevealed(true);

  return (
    <Component
      ref={ref}
      className={className}
      initial="hidden"
      animate={show ? "visible" : "hidden"}
      variants={instant ? staggerVariants(0, 0) : staggerVariants(stagger, delay)}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const Component = m[as];

  return (
    <Component data-motion className={className} variants={riseVariants}>
      {children}
    </Component>
  );
}

/**
 * Lift on hover.
 *
 * Deliberately not a tilt or a 3D rotation: those read as a demo. A 4px lift
 * with a softening shadow is what a physical card does when you pick it up,
 * and it survives being used on thirty cards at once without the page feeling
 * unstable.
 *
 * `whileTap` matters more than it looks — on a phone there is no hover, and
 * without it a card gives no feedback at all when pressed.
 */
export function HoverLift({
  children,
  className,
  lift = 4,
}: {
  children: React.ReactNode;
  className?: string;
  lift?: number;
}) {
  return (
    <m.div
      className={cn("h-full", className)}
      whileHover={{ y: -lift }}
      whileTap={{ scale: 0.985 }}
      transition={transition(DURATION.quick)}
    >
      {children}
    </m.div>
  );
}
