"use client";

import { type MusicVisualContent } from "@zoonk/core/steps/contract/visual";
import abcjs from "abcjs";
import { useEffect, useRef } from "react";

/**
 * Renders ABC music notation as SVG using ABCJS.
 *
 * `staffwidth` controls how wide ABCJS draws the staff and spaces
 * notes within it. `responsive: "resize"` then scales the SVG to
 * fill the container. With larger staffwidth values (e.g., 200+),
 * short phrases only use a fraction of the staff, leaving empty
 * space on the right that makes the notation look left-aligned.
 * A small staffwidth (50) forces ABCJS to pack notes tightly so
 * they fill the staff, and responsive scaling enlarges everything
 * to fit the container — keeping notation centered and properly
 * sized regardless of how many notes there are.
 *
 * Dark mode is handled by reading the current foreground
 * color from CSS and passing it to ABCJS as `foregroundColor`.
 */
export function MusicVisual({ content }: { content: MusicVisualContent }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const foreground = getComputedStyle(containerRef.current).getPropertyValue("color");

    abcjs.renderAbc(containerRef.current, content.abc, {
      foregroundColor: foreground,
      responsive: "resize",
      staffwidth: 50,
    });
  }, [content.abc]);

  return (
    <figure
      aria-label={content.description}
      className="flex w-full max-w-xl flex-col items-center gap-4 px-6 sm:gap-5 sm:px-8"
    >
      <div
        className="text-foreground w-full min-w-0 overflow-x-auto"
        ref={containerRef}
        role="img"
      />

      <figcaption className="text-muted-foreground text-center text-sm">
        {content.description}
      </figcaption>
    </figure>
  );
}
