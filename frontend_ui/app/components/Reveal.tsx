"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "../lib/gsap";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds of stagger between direct children. 0 animates them together. */
  stagger?: number;
  /** "scroll": play once when scrolled into view (default). "mount": play immediately. */
  trigger?: "scroll" | "mount";
  y?: number;
  /** Extra deps that should replay a "mount" reveal (e.g. a new chat turn, a new prediction). */
  replayKey?: unknown;
};

// One entrance animation, reused everywhere instead of hand-rolled
// ScrollTrigger/timeline setup at each call site. It always animates its
// own direct children, so wrapping one element or a whole .map() of six
// cards uses the exact same component.
export default function Reveal({
  children,
  className,
  stagger = 0,
  trigger = "scroll",
  y = 24,
  replayKey,
}: RevealProps) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!container.current) return;
      const targets = gsap.utils.toArray<HTMLElement>(container.current.children);
      if (!targets.length) return;

      if (prefersReducedMotion()) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }

      const from = { opacity: 0, y };
      const to = { opacity: 1, y: 0, duration: 0.7, stagger, ease: "power3.out" };

      if (trigger === "mount") {
        gsap.fromTo(targets, from, to);
      } else {
        gsap.fromTo(targets, from, {
          ...to,
          scrollTrigger: {
            trigger: container.current,
            start: "top 88%",
            once: true,
          },
        });
      }
    },
    { scope: container, dependencies: trigger === "mount" ? [replayKey] : [] }
  );

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
