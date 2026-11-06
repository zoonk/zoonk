"use client";

import { createContext, use } from "react";

const SpokenMathContext = createContext(false);

/**
 * For text that names something: a radio, a button, a heading, a label. Chromium leaves MathML out
 * of a name computed from content, so formulas inside draw for the eye and read in words.
 */
export function SpokenMath({ children }: { children: React.ReactNode }) {
  return <SpokenMathContext value>{children}</SpokenMathContext>;
}

export function useSpokenMath(): boolean {
  return use(SpokenMathContext);
}

export function MathMarkupView({ markup, words }: { markup: string; words: string }) {
  const spoken = useSpokenMath();

  const drawing = (
    <span
      aria-hidden={spoken || undefined}
      // eslint-disable-next-line react/no-danger -- KaTeX returns escaped MathML with trust disabled, which lets formulas render without allowing AI-provided HTML.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );

  if (!spoken) {
    return drawing;
  }

  return (
    <>
      {drawing}
      <span className="sr-only">{words}</span>
    </>
  );
}
