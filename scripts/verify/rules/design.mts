import { type Rule, UI } from "./shared.mts";

/** What a designer questions in code: tokens, accessible names and controls, focus, motion and images. */
export const DESIGN_RULES: Rule[] = [
  {
    files: UI,
    line: /#[0-9a-f]{3,8}\b|\brgba?\(|\boklch\(|\b(?:bg|text|border|ring|fill|stroke)-\[#/iu,
    name: "Raw color",
    question:
      "Which design-system token means this? A color outside the tokens has no meaning and breaks in dark mode and more contrast.",
    role: "design",
  },
  {
    files: UI,
    line: /\b[a-z-]+-\[\d+(?:\.\d+)?(?:px|rem)\]/u,
    name: "One-off size",
    question:
      "Is there a token or scale step for this size or spacing (the 4px scale, the type roles)?",
    role: "design",
  },
  {
    files: UI,
    line: /\baria-label=/u,
    name: "Accessible name",
    question:
      "Does the label start with the visible text (label in name)? Otherwise voice control can't find the control by what it shows.",
    role: "design",
  },
  {
    files: UI,
    line: /<(?:div|span|li)\b[^>]*\bonClick=/u,
    name: "Click on a non-control",
    question: "Use a button or link so keyboards and screen readers can reach it.",
    role: "design",
  },
  {
    files: UI,
    line: /^(?!.*focus-visible:).*\boutline-none\b/u,
    name: "Focus outline removed",
    question: "Is keyboard focus still visible (a focus-visible ring)?",
    role: "design",
  },
  {
    files: UI,
    line: /\banimate-(?!none)|\bmotion\.|\buseSpring\(|@keyframes/u,
    name: "Motion",
    question:
      "Does zoonk-motion allow it here (everyday screens stay still), and does it have a calm reduced-motion version?",
    role: "design",
  },
  {
    files: UI,
    line: /<img\b/u,
    name: "Plain image",
    question: "Use next/image (sizes, lazy loading, no layout shift).",
    role: "design",
  },
];
