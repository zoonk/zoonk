import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getLanguagePromptContext } from "../_utils/prompt-language";
import { type LessonProblem, formatLessonProblems } from "../lesson-writer/format-lesson-plan";
import fixPrompt from "./alphabet-lesson-fix.prompt.md";
import systemPrompt from "./alphabet-lesson.prompt.md";

/**
 * Written once per script and learner language and shared: Luna scored 9.21 on the alphabet-lesson
 * eval, ahead of Sol at a fraction of the cost (27 Sep 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["openai/gpt-6.1-terra", "google/gemini-3.8-flash"] as const;

const MIN_INTRO = 1;
const MAX_INTRO = 2;
const MIN_LETTERS = 6;
const MAX_LETTERS = 10;
const MIN_SUMMARY = 2;
const MAX_SUMMARY = 3;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the script and what the lesson covers come before its screens, and a letter's sound and audio before the cue that describes them. */
const letterSchema = z.object({
  symbol: z.string(),
  readingAid: z.string(),
  ipa: z.string(),
  audioText: z.string(),
  pronunciation: z.string(),
  forms: z.array(z.object({ label: z.string(), symbol: z.string() })),
});

const schema = z.object({
  script: z.string(),
  title: z.string(),
  description: z.string(),
  canDo: z.string(),
  intro: z
    .array(z.object({ title: z.string(), text: z.string() }))
    .min(MIN_INTRO)
    .max(MAX_INTRO),
  letters: z.array(letterSchema).min(MIN_LETTERS).max(MAX_LETTERS),
  summary: z.array(z.string()).min(MIN_SUMMARY).max(MAX_SUMMARY),
});
/* oxlint-enable eslint/sort-keys */

export type AlphabetLessonContent = z.infer<typeof schema>;

type WrittenLetter = AlphabetLessonContent["letters"][number];

/** What learners see: a letter's IPA and the script's name guide the writer and aren't kept. */
export type PublishedAlphabetLesson = Omit<AlphabetLessonContent, "letters" | "script"> & {
  letters: Omit<WrittenLetter, "ipa">[];
};

export type GenerateAlphabetLessonParams = {
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatLanguages(params: { learnerLanguage: string; targetLanguage: string }): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
  `;
}

async function runAlphabetLessonTask({
  instructions,
  params,
  task,
  userPrompt,
}: {
  instructions: string;
  params: GenerateAlphabetLessonParams;
  task: string;
  userPrompt: string;
}) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt: instructions,
    task,
  });

  return {
    data: result.output,
    provenance,
    systemPrompt: instructions,
    usage: result.usage,
    userPrompt,
  };
}

export async function generateAlphabetLesson(params: GenerateAlphabetLessonParams) {
  return runAlphabetLessonTask({
    instructions: systemPrompt,
    params,
    task: "alphabet-lesson",
    userPrompt: formatLanguages(params),
  });
}

/** The intro screens, then one card per letter: the screens a reviewer numbers its problems by. */
export function listAlphabetScreens(lesson: Pick<PublishedAlphabetLesson, "intro" | "letters">) {
  return [
    ...lesson.intro.map((content) => ({ content, kind: "explanation" as const })),
    ...lesson.letters.map((content) => ({ content, kind: "alphabet" as const })),
  ];
}

function formatPublishedLesson(lesson: PublishedAlphabetLesson): string {
  const screens = listAlphabetScreens(lesson).map((screen, index) => ({
    screen: index + 1,
    ...screen,
  }));

  return JSON.stringify(
    {
      canDo: lesson.canDo,
      description: lesson.description,
      screens,
      summary: lesson.summary,
      title: lesson.title,
    },
    null,
    1,
  );
}

function toPublishedLetter({
  audioText,
  forms,
  pronunciation,
  readingAid,
  symbol,
}: WrittenLetter): PublishedAlphabetLesson["letters"][number] {
  return { audioText, forms, pronunciation, readingAid, symbol };
}

/** Only the screens a problem names change, so unflagged letters keep their words and audio. */
function applyAlphabetFixes({
  fixed,
  lesson,
  problems,
}: {
  fixed: AlphabetLessonContent;
  lesson: PublishedAlphabetLesson;
  problems: readonly LessonProblem[];
}): PublishedAlphabetLesson {
  const flagged = new Set(problems.flatMap((problem) => problem.screen ?? []));
  const introCount = lesson.intro.length;

  return {
    ...lesson,
    intro: lesson.intro.map((screen, index) =>
      flagged.has(index) ? (fixed.intro[index] ?? screen) : screen,
    ),
    letters: lesson.letters.map((letter, index) => {
      const fix = fixed.letters[index];
      return flagged.has(introCount + index) && fix ? toPublishedLetter(fix) : letter;
    }),
    summary: problems.some((problem) => problem.screen === null) ? fixed.summary : lesson.summary,
  };
}

export type FixAlphabetLessonParams = GenerateAlphabetLessonParams & {
  lesson: PublishedAlphabetLesson;
  /** `screen` indexes `listAlphabetScreens(lesson)`, or is null for the summary. */
  problems: LessonProblem[];
};

export async function fixAlphabetLesson(params: FixAlphabetLessonParams) {
  const { lesson, problems } = params;

  const userPrompt = `${formatLanguages(params)}
PUBLISHED_LESSON:
${formatPublishedLesson(lesson)}

PROBLEMS:
${formatLessonProblems(problems)}
`;

  const fix = await runAlphabetLessonTask({
    instructions: `${systemPrompt}\n${fixPrompt}`,
    params,
    task: "alphabet-lesson-fix",
    userPrompt,
  });

  return { ...fix, data: applyAlphabetFixes({ fixed: fix.data, lesson, problems }) };
}
