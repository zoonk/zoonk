"use client";

import { type FormulaVisualContent } from "@zoonk/core/steps/contract/visual";
import { render } from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useRef } from "react";

/**
 * Renders a LaTeX math expression using KaTeX.
 *
 * KaTeX renders math into MathML + HTML, which provides native screen reader
 * support. The description stays visible as a caption for extra context.
 *
 * Long formulas are allowed to scroll horizontally inside the shared visual
 * region. That keeps narrow screens usable without reintroducing measurement
 * logic or scaling the text down until short formulas look undersized. The
 * caption sits outside the centered flow so the formula itself stays aligned
 * with the visual stage instead of being offset by the extra caption height.
 * We also add a tiny desktop-only optical nudge because centered typography
 * can still look slightly high next to the circular navigation arrows.
 */
export function FormulaVisual({ content }: { content: FormulaVisualContent }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    render(content.formula, containerRef.current, {
      displayMode: true,
      output: "htmlAndMathml",
      throwOnError: false,
      trust: false,
    });
  }, [content.formula]);

  return (
    <figure
      aria-label={content.description}
      className="relative flex w-full max-w-full min-w-0 flex-col items-center"
    >
      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
        <div className="flex w-max min-w-full justify-center px-4 sm:px-5">
          <div
            className="text-foreground shrink-0 text-lg sm:text-xl lg:translate-y-0.5"
            ref={containerRef}
            role="math"
          />
        </div>
      </div>

      <figcaption className="text-muted-foreground absolute top-full left-1/2 mt-3 w-full max-w-md -translate-x-1/2 px-4 text-center text-sm sm:px-5">
        {content.description}
      </figcaption>
    </figure>
  );
}
