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
 * This renderer stays intentionally simple: formulas should behave like a
 * centered visual, not a nested scroll area or an auto-scaling widget.
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
      className="flex w-full max-w-xl flex-col items-center gap-4 px-4 sm:gap-5 sm:px-5"
    >
      <div
        className="text-foreground w-full min-w-0 text-lg sm:text-xl"
        ref={containerRef}
        role="math"
      />

      <figcaption className="text-muted-foreground text-center text-sm">
        {content.description}
      </figcaption>
    </figure>
  );
}
