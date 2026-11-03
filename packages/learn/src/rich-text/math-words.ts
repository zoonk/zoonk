import { ATTACHED_MARKS, type Accent } from "./math-symbols";

export type MathWords = Record<Accent, (base: string) => string> & {
  cubeRoot: (radicand: string) => string;
  cubed: string;
  fraction: (parts: { denominator: string; numerator: string }) => string;
  nthRoot: (parts: { index: string; radicand: string }) => string;
  power: (exponent: string) => string;
  root: (radicand: string) => string;
  squared: string;
  subscript: (index: string) => string;
};

export type Script = "normal" | "subscript" | "superscript";

export function spokenScript({
  said,
  style,
  words,
}: {
  said: string;
  style: Script;
  words: MathWords;
}): string {
  if (said === "" || ATTACHED_MARKS.has(said)) {
    return said;
  }

  if (style === "subscript") {
    return ` ${words.subscript(said)} `;
  }

  if (said === "2") {
    return ` ${words.squared} `;
  }

  if (said === "3") {
    return ` ${words.cubed} `;
  }

  return ` ${words.power(said)} `;
}

export function spokenRoot({
  index,
  radicand,
  words,
}: {
  index: string;
  radicand: string;
  words: MathWords;
}): string {
  if (index === "" || index === "2") {
    return words.root(radicand);
  }

  return index === "3" ? words.cubeRoot(radicand) : words.nthRoot({ index, radicand });
}
