import { useExtracted } from "next-intl";
import { type MathWords } from "./math-speech";
import { speakRichBlocks, speakRichInline } from "./rich-text-speech";

export function useMathWords(): MathWords {
  const t = useExtracted();

  return {
    cubed: t({
      description: 'Screen reader words for a formula, said after its base: "x cubed".',
      message: "cubed",
    }),
    fraction: (fractionParts) =>
      t({
        description: 'Screen reader words for a fraction: "1 over 4".',
        message: "{numerator} over {denominator}",
        values: fractionParts,
      }),
    power: (exponent) =>
      t({
        description:
          'Screen reader words for an exponent, said after its base: "2 to the power of 10".',
        message: "to the power of {exponent}",
        values: { exponent },
      }),
    root: (radicand) =>
      t({
        description: 'Screen reader words for a square root: "square root of 2".',
        message: "square root of {radicand}",
        values: { radicand },
      }),
    squared: t({
      description: 'Screen reader words for a formula, said after its base: "x squared".',
      message: "squared",
    }),
    subscript: (index) =>
      t({
        description: 'Screen reader words for an index, said after its base: "x sub 1".',
        message: "sub {index}",
        values: { index },
      }),
  };
}

/**
 * Lesson rich text as a screen reader should hear it, for an `aria-label`, an announcement or any
 * other string: "Matched 1 over 2 with 0.5.", never "Matched $\frac{1}{2}$ with 0.5.". Read it the
 * way the screen draws it: `inline` for text drawn with `LessonRichText`, `blocks` for
 * `RichTextBlocks`.
 */
export function useSpokenText(): {
  blocks: (text: string) => string;
  inline: (text: string) => string;
} {
  const words = useMathWords();

  return {
    blocks: (text) => speakRichBlocks({ text, words }),
    inline: (text) => speakRichInline({ text, words }),
  };
}
