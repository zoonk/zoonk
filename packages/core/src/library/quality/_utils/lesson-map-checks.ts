import { getLessonMapIdeaKey } from "@zoonk/ai/tasks/lesson-writer/map";
import { type LessonMap } from "@zoonk/ai/tasks/lesson-writer/schema";
import { lessonMapSchema } from "../../lessons/lesson-map";
import { type LessonCheckProblem } from "../lesson-code-checks";
import { findLessonPhrases } from "./lesson-phrases";
import { findTextFlaws } from "./screen-flaws";

const MAX_SUMMARY_SENTENCES = 2;
const SENTENCE_END = /[.!?…](?:\s|$)/gu;

function countSentences(text: string): number {
  return Math.max(1, [...text.matchAll(SENTENCE_END)].length);
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

  const writing = summary.flatMap((idea) => findTextFlaws({ layout: "inline", text: idea }));

  const problems = [
    ...writing,
    !parsed.success && {
      code: "summary" as const,
      problem: `The summary card is invalid: ${parsed.error?.issues.map((issue) => issue.message).join("; ")}.`,
    },
    summary.some((idea) => countSentences(idea) > MAX_SUMMARY_SENTENCES) && {
      code: "summary" as const,
      problem: "Each summary idea is one sentence.",
    },
    new Set(normalized).size !== normalized.length && {
      code: "summary" as const,
      problem: "Two summary ideas say the same thing.",
    },
    summary.some((idea) => findLessonPhrases({ language, text: idea }).framing.length > 0) && {
      code: "lessonFraming" as const,
      problem: "The summary talks about the lesson itself; state each idea directly.",
    },
  ];

  return problems
    .filter((problem) => problem !== false)
    .map((problem) => ({ ...problem, screen: null }));
}
