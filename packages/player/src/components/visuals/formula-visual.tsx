"use client";

import { type FormulaVisualContent } from "@zoonk/core/steps/visual-content-contract";
import { render } from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useRef } from "react";

/**
 * Renders a LaTeX math expression using KaTeX.
 *
 * KaTeX renders math into MathML + HTML, which provides native screen reader
 * support. The `description` field is shown as a caption for additional context.
 * We use `useEffect` + `useRef` to imperatively render KaTeX into the DOM,
 * matching the same pattern used by `code-visual.tsx` with shiki.
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
      className="flex w-full max-w-xl flex-col items-center gap-4 px-6 sm:gap-5 sm:px-8"
    >
      <div
        className="text-foreground w-full min-w-0 overflow-x-auto text-2xl sm:text-3xl"
        ref={containerRef}
        role="math"
      />

      <figcaption className="text-muted-foreground text-center text-sm">
        {content.description}
      </figcaption>
    </figure>
  );
}
