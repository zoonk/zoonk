"use client";

import { type MusicVisualContent } from "@zoonk/core/steps/visual-content-contract";
import abcjs from "abcjs";
import { useEffect, useRef, useState } from "react";

/**
 * Renders ABC music notation as SVG using ABCJS.
 *
 * ABCJS imperatively renders SVG into the target DOM element, matching
 * the same useEffect + useRef pattern used by formula-visual.tsx (KaTeX)
 * and code-visual.tsx (shiki). The `description` field provides both an
 * aria-label for screen readers and a visible caption explaining the notation.
 *
 * We use `responsive: "resize"` so ABCJS reflows measures to new lines
 * when the container is narrow (e.g., on mobile), rather than requiring
 * horizontal scrolling which breaks the spatial relationship between notes.
 *
 * Dark mode is handled by reading the current foreground color from CSS
 * and passing it to ABCJS as `foregroundColor`, so the SVG renders with
 * the correct theme color from the start.
 */
export function MusicVisual({ content }: { content: MusicVisualContent }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const foreground = getComputedStyle(containerRef.current).getPropertyValue("color");

    abcjs.renderAbc(containerRef.current, content.abc, {
      foregroundColor: foreground,
      responsive: "resize",
    });

    setRendered(true);
  }, [content.abc]);

  return (
    <figure
      aria-label={content.description}
      className="flex w-full min-w-0 flex-col items-center gap-4 sm:gap-5"
    >
      <div
        className={`text-foreground w-full min-w-0 transition-opacity duration-300 ${rendered ? "opacity-100" : "opacity-0"}`}
        ref={containerRef}
        role="img"
      />

      <figcaption className="text-muted-foreground text-center text-sm">
        {content.description}
      </figcaption>
    </figure>
  );
}
