import type { Transition, Variants } from "motion/react";

/**
 * One motion vocabulary for the whole public site.
 *
 * Expensive-feeling motion is not *more* motion — it is less, moving further
 * apart in time. Everything here follows three rules:
 *
 *  - One easing curve. A page where each element eases differently reads as
 *    assembled from parts. This is an ease-out-expo: a quick start that
 *    decelerates for a long time, which is what reads as weight.
 *  - Short distances. 24px, not 100px. Long travel looks like a slideshow.
 *  - Sequenced, not simultaneous. Siblings follow each other 70ms apart, so
 *    the eye is led rather than ambushed.
 *
 * Durations are deliberately near the top of the comfortable range: fast
 * animation feels efficient, slow animation feels considered, and this is a
 * site selling considered holidays.
 */

/** Ease-out-expo. The only curve used anywhere on the public site. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  /** Hover, taps — anything answering a pointer must feel instant. */
  quick: 0.3,
  /** The default for a section arriving on scroll. */
  reveal: 0.65,
  /** The hero, which nobody is waiting on. */
  entrance: 0.9,
} as const;

/** Distance a revealing element travels. Small on purpose. */
export const RISE = 24;

export const transition = (duration: number = DURATION.reveal, delay = 0): Transition => ({
  duration,
  delay,
  ease: EASE,
});

/**
 * Rise-and-fade. `hidden` is also expressed in CSS (see globals.css) so that
 * a page with no JavaScript is not a blank one.
 */
export const riseVariants: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: transition() },
};

/** A parent that releases its children one after another. */
export const staggerVariants = (stagger = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

/**
 * When an element counts as "arrived".
 *
 * `amount: 0.15` with the negative bottom margin means a section starts
 * moving just before it is fully in view, so it has finished by the time it
 * is being read. Animating on the first pixel makes a page feel like it is
 * permanently twitching at the edges.
 *
 * The large *top* margin is the important part. An IntersectionObserver only
 * reports elements that are inside its root, so anything scrolled past
 * between two observed frames never fires and stays invisible for good.
 * That is not hypothetical — it happens on an anchor link into the middle of
 * a page, on a fast flick-scroll, on End, and every time a browser restores
 * the scroll position on reload. Extending the root upwards turns the test
 * from "is on screen" into "has reached or passed the trigger line", which is
 * what a scroll reveal actually means.
 */
export const IN_VIEW = {
  once: true,
  amount: 0.15,
  margin: "9999px 0px -80px 0px",
} as const;
