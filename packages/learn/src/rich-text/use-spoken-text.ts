import { useExtracted } from "next-intl";
import { type MathWords } from "./math-words";
import { speakRichBlocks, speakRichInline } from "./rich-text-speech";

export function useMathWords(): MathWords {
  const t = useExtracted();

  return {
    bar: (base) =>
      t({
        description:
          'Screen reader words for a letter with a bar over it, such as a mean: "x bar".',
        message: "{base} bar",
        values: { base },
      }),
    cubeRoot: (radicand) =>
      t({
        description: 'Screen reader words for a cube root: "cube root of 8".',
        message: "cube root of {radicand}",
        values: { radicand },
      }),
    cubed: t({
      description: 'Screen reader words for a formula, said after its base: "x cubed".',
      message: "cubed",
    }),
    dot: (base) =>
      t({
        description:
          'Screen reader words for a letter with a dot over it, a rate of change in physics: "x dot".',
        message: "{base} dot",
        values: { base },
      }),
    fraction: (fractionParts) =>
      t({
        description: 'Screen reader words for a fraction: "1 over 4".',
        message: "{numerator} over {denominator}",
        values: fractionParts,
      }),
    hat: (base) =>
      t({
        description:
          'Screen reader words for a letter with a hat over it, such as an estimate: "p hat".',
        message: "{base} hat",
        values: { base },
      }),
    nthRoot: (rootParts) =>
      t({
        description:
          'Screen reader words for a root with an index other than 2 or 3; {index} is a number such as 4 or a letter such as n: "4th root of 16", "nth root of x".',
        message: "{index}th root of {radicand}",
        values: rootParts,
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
    tilde: (base) =>
      t({
        description: 'Screen reader words for a letter with a tilde over it: "x tilde".',
        message: "{base} tilde",
        values: { base },
      }),
    vector: (base) =>
      t({
        description:
          'Screen reader words for a letter with an arrow over it, a vector: "vector v".',
        message: "vector {base}",
        values: { base },
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
