import { getLessonMapIdeaKey } from "@zoonk/ai/tasks/lesson-writer/map";
import { type LessonMap } from "@zoonk/ai/tasks/lesson-writer/schema";
import { findBareLatex } from "@zoonk/utils/bare-latex";
import { parseInlineMarkupRanges } from "@zoonk/utils/inline-markup";
import { findMathSpans } from "@zoonk/utils/math-spans";
import { findPlaceholderText, findUnrenderedMarkdown } from "@zoonk/utils/text-flaws";
import { lessonMapSchema } from "../../lessons/lesson-map";
import { type LessonCheckProblem } from "../lesson-code-checks";
import { findLessonPhrases } from "./lesson-phrases";
import { findTextFlaws } from "./screen-flaws";

const MAX_SUMMARY_SENTENCES = 2;

/** Japanese and Chinese sentences end on 。！？ with no space, so a pattern of marks misses them. */
function countSentences({ language, text }: { language: string; text: string }): number {
  const segments = new Intl.Segmenter(language, { granularity: "sentence" }).segment(text);

  return [...segments].filter(({ segment }) => segment.trim()).length;
}

type MapFlaw = Pick<LessonCheckProblem, "code" | "problem">;

function hasMath(label: string): boolean {
  return (
    findMathSpans(label).length > 0 || findBareLatex({ layout: "inline", text: label }).length > 0
  );
}

function hasMarkup(label: string): boolean {
  return (
    findUnrenderedMarkdown({ layout: "inline", text: label }).length > 0 ||
    parseInlineMarkupRanges(label).some((range) => range.kind !== "text")
  );
}

/** Every player draws a label as plain text, so math, marks and tags in it show as typed. */
function findLabelFlaws(label: string): MapFlaw[] {
  const problems: (MapFlaw | false)[] = [
    hasMath(label) && {
      code: "rawMath",
      problem: `The label "${label}" shows math as typed, since labels are plain text; name it in words.`,
    },
    hasMarkup(label) && {
      code: "markdown",
      problem: `The label "${label}" shows marks or tags as typed, since labels are plain text; write it without them.`,
    },
    ...findPlaceholderText(label).map((problem) => ({ code: "placeholder" as const, problem })),
  ];

  return problems.filter((problem) => problem !== false);
}

function findIdeaFlaws({ language, map }: { language: string; map: LessonMap }): MapFlaw[] {
  const texts = map.ideas.flatMap(({ label, text }) => [
    { flaws: findTextFlaws({ layout: "inline", text }), text },
    ...(label ? [{ flaws: findLabelFlaws(label), text: label }] : []),
  ]);

  return texts.flatMap(({ flaws, text }) => {
    const phrases = findLessonPhrases({ language, text });

    return [
      ...flaws,
      ...phrases.framing.map((phrase) => ({
        code: "lessonFraming" as const,
        problem: `The summary talks about the lesson itself ("${phrase}"); state each idea directly.`,
      })),
      ...phrases.filler.map((phrase) => ({
        code: "filler" as const,
        problem: `The summary uses filler ("${phrase}"); cut it and state the idea directly.`,
      })),
    ];
  });
}

export function getLessonMapProblems({
  language,
  map,
}: {
  language: string;
  map: LessonMap;
}): LessonCheckProblem[] {
  const parsed = lessonMapSchema.safeParse(map);
  const summary = map.ideas.map((idea) => idea.text);

  const normalized = map.ideas.map((idea) => getLessonMapIdeaKey(idea));

  const problems = [
    ...findIdeaFlaws({ language, map }),
    !parsed.success && {
      code: "summary" as const,
      problem: `The summary card is invalid: ${parsed.error?.issues.map((issue) => issue.message).join("; ")}.`,
    },
    summary.some((text) => countSentences({ language, text }) > MAX_SUMMARY_SENTENCES) && {
      code: "summary" as const,
      problem: "Each summary idea is one sentence.",
    },
    new Set(normalized).size !== normalized.length && {
      code: "summary" as const,
      problem: "Two summary ideas say the same thing.",
    },
  ];

  return problems
    .filter((problem) => problem !== false)
    .map((problem) => ({ ...problem, screen: null }));
}
