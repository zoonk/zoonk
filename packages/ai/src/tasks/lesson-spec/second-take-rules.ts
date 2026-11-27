import { type LessonMap } from "../lesson-writer/written-lesson-schema";
import { type LessonSpec } from "./lesson-spec-rules";

/** A wrong option one of the skill's questions offers, and why it's wrong. */
type SecondTakeWrongAnswer = { question: string; answer: string; reason: string };

/**
 * What a second explanation of a skill needs, Library content only: the map of the lesson learners
 * studied and the wrong answers its questions already expect.
 */
export type SecondTakeInput = { firstLessonMap: LessonMap; wrongAnswers: SecondTakeWrongAnswer[] };

/** About 4 minutes: a learner who keeps missing an idea gets a short lesson, not a second course. */
export const SECOND_TAKE_SCREENS = { max: 10, min: 6 } as const;

/** Shorter sentences are facts both lessons may state alike ("Ice floats on water."). */
const MIN_COPIED_WORDS = 6;

type SecondTakeIssueCode = "copiedSentence" | "opening" | "screenCount" | "wrongAnswer";

export type SecondTakeIssue = { code: SecondTakeIssueCode; detail: string };

function findCopiedSentence({
  language,
  map,
  spec,
}: {
  language?: string;
  map: LessonMap;
  spec: LessonSpec;
}): string | undefined {
  const sentences = new Intl.Segmenter(language, { granularity: "sentence" });
  const words = new Intl.Segmenter(language, { granularity: "word" });

  const tokenize = (text: string) =>
    [...words.segment(text.normalize("NFC").toLowerCase())].flatMap(({ isWordLike, segment }) =>
      isWordLike ? [segment] : [],
    );

  const briefs = spec.screens.map((screen) => ` ${tokenize(screen.brief).join(" ")} `);

  return map.ideas
    .flatMap((idea) => [...sentences.segment(idea.text)])
    .find(({ segment }) => {
      const tokens = tokenize(segment);

      return (
        tokens.length >= MIN_COPIED_WORDS &&
        briefs.some((brief) => brief.includes(` ${tokens.join(" ")} `))
      );
    })
    ?.segment.trim();
}

/**
 * What code can check of a second take before it's saved: its size, an opening question right
 * after the scene, built on one of the wrong answers it was given, and no sentence of the first
 * lesson's map said again. Whether it really explains the idea another way is for readers.
 */
export function getSecondTakeIssues({
  language,
  secondTake,
  spec,
}: {
  language?: string;
  secondTake: SecondTakeInput;
  spec: LessonSpec;
}): SecondTakeIssue[] {
  const count = spec.screens.length;
  const copied = findCopiedSentence({ language, map: secondTake.firstLessonMap, spec });
  const answers = secondTake.wrongAnswers.length;
  const opensOn = spec.opensOn ?? 0;

  return [
    (count < SECOND_TAKE_SCREENS.min || count > SECOND_TAKE_SCREENS.max) && {
      code: "screenCount" as const,
      detail: `Has ${count} screens; a second take has ${SECOND_TAKE_SCREENS.min} to ${SECOND_TAKE_SCREENS.max}.`,
    },
    spec.screens[1]?.kind !== "guess" && {
      code: "opening" as const,
      detail: "The screen after the scene must be the guess built on a tempting wrong answer.",
    },
    answers > 0 &&
      (opensOn < 1 || opensOn > answers) && {
        code: "wrongAnswer" as const,
        detail: `Opens on wrong answer ${opensOn}, which isn't one of the ${answers} given.`,
      },
    copied !== undefined && {
      code: "copiedSentence" as const,
      detail: `A brief repeats the first lesson's sentence "${copied}".`,
    },
  ].filter((issue) => issue !== false);
}

export function formatSecondTake({ firstLessonMap, wrongAnswers }: SecondTakeInput): string {
  const ideas = firstLessonMap.ideas.map((idea) =>
    idea.label ? `- ${idea.label}: ${idea.text}` : `- ${idea.text}`,
  );

  const answers = wrongAnswers.map(
    (wrong, index) =>
      `${index + 1}. Question: ${wrong.question}\n   Wrong answer: ${wrong.answer}\n   Why it's wrong: ${wrong.reason}`,
  );

  return `
FIRST_LESSON_MAP:
${ideas.join("\n")}

WRONG_ANSWERS:
${answers.length > 0 ? answers.join("\n") : "none"}
`;
}
