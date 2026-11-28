import "server-only";
import { generateLanguageLessonActivities } from "@zoonk/ai/tasks/language/language-lesson";
import { checkLanguageLesson } from "@zoonk/ai/tasks/language/language-lesson-check";
import { type StepKind, prisma } from "@zoonk/db";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { toReviewProblems } from "../quality/lesson-review-problems";
import { safeParseStepContent } from "../steps/contract/step-contract";
import { cleanLanguageActivities } from "./_utils/clean-language-lesson";
import { buildLanguageActivities } from "./_utils/language-lesson-activities";
import { readLanguageLessonInputs } from "./_utils/language-lesson-inputs";
import { listStoredLanguageReviewScreens } from "./_utils/language-review-screens";
import { ALPHABET_IDENTITY_PREFIX } from "./alphabet/alphabet-identity";

type Analytics = Parameters<typeof generateLanguageLessonActivities>[0]["analytics"];
type Template = "dialogue" | "patternTable";

const TEMPLATE_NAMES: Record<Template, string> = {
  dialogue: "a dialogue",
  patternTable: "a pattern table",
};

/** `stepId` is the published screen a problem names, or null for the whole lesson. */
type Finding = { problem: string; stepId: string | null };

/** A screen of the fix: `{ id }` keeps a published screen, `{ kind, content }` adds one. */
type ScreenEntry = { id: string } | { content: object; kind: "activity"; skillId: string };

export type LanguageActivitiesDraft =
  | { lessonId: string; status: "skipped"; reason: string }
  | {
      lessonId: string;
      status: "drafted";
      added: Template[];
      /** Why a screen the writer wrote was left out. */
      dropped: string[];
      /** What the check found on the lesson's published screens, which this fix leaves as they are. */
      findings: Finding[];
      setScreens: { screens: ScreenEntry[]; version: number };
      reason: string;
    };

const AFTER_DIALOGUE = new Set<StepKind>(["spokenAnswer", "typedAnswer", "summary"]);

type StoredLesson = NonNullable<Awaited<ReturnType<typeof findLesson>>>;
type StoredStep = StoredLesson["steps"][number];

async function findLesson(lessonId: string) {
  return prisma.lesson.findUnique({
    select: {
      contentStatus: true,
      identityKey: true,
      sentences: {
        orderBy: [{ position: "asc" }, { sentenceId: "asc" }],
        select: {
          distractors: true,
          explanation: true,
          sentence: { select: { sentence: true } },
          sentenceId: true,
          translation: true,
          translationDistractors: true,
        },
      },
      steps: {
        orderBy: { position: "asc" },
        select: {
          content: true,
          id: true,
          kind: true,
          sentenceId: true,
          version: true,
          wordId: true,
        },
        where: CURRENT_STEPS,
      },
      targetLanguage: true,
      words: {
        orderBy: [{ position: "asc" }, { wordId: "asc" }],
        select: {
          distractors: true,
          note: true,
          translation: true,
          word: { select: { romanization: true, word: true } },
          wordId: true,
        },
      },
    },
    where: { id: lessonId },
  });
}

function findSkipReason(lesson: StoredLesson | null): string | null {
  if (!lesson?.targetLanguage) {
    return "Not a language lesson.";
  }

  if (lesson.identityKey.startsWith(ALPHABET_IDENTITY_PREFIX)) {
    return "An alphabet lesson.";
  }

  if (lesson.contentStatus !== "completed" || lesson.steps.length === 0) {
    return "Not written yet.";
  }

  if (lesson.steps.some((step) => step.kind === "activity")) {
    return "Already has an activity screen.";
  }

  return null;
}

function readTip(steps: readonly StoredStep[]) {
  const tip = steps.find((step) => step.kind === "explanation");
  const parsed = tip ? safeParseStepContent("explanation", tip.content) : null;

  return parsed?.success ? { text: parsed.data.text, title: parsed.data.title ?? "" } : null;
}

/** Where new lessons put each screen: the table right after the tip, the dialogue before speaking. */
function findSlots(steps: readonly StoredStep[]): Record<Template, number> {
  const tip = steps.findLastIndex((step) => step.kind === "explanation");
  const firstSpoken = steps.findIndex((step) => AFTER_DIALOGUE.has(step.kind));

  return { dialogue: firstSpoken === -1 ? steps.length : firstSpoken, patternTable: tip + 1 };
}

function placeActivities({
  activities,
  steps,
}: {
  activities: Partial<Record<Template, object>>;
  steps: readonly StoredStep[];
}) {
  const slots = findSlots(steps);

  const insertAt = (index: number) =>
    (["patternTable", "dialogue"] as const).flatMap((template) => {
      const content = activities[template];
      return content && slots[template] === index ? [{ content, template }] : [];
    });

  return [
    ...steps.flatMap((step, index) => [...insertAt(index), { step }]),
    ...insertAt(steps.length),
  ];
}

function toReviewScreens({
  lesson,
  placed,
}: {
  lesson: StoredLesson;
  placed: ReturnType<typeof placeActivities>;
}) {
  const words = new Map(lesson.words.map((row) => [row.wordId, row]));
  const sentences = new Map(lesson.sentences.map((row) => [row.sentenceId, row]));

  return listStoredLanguageReviewScreens(
    placed.map((entry) => {
      if (!("step" in entry)) {
        return { content: entry.content, kind: "activity", sentence: null, word: null };
      }

      const word = entry.step.wordId ? words.get(entry.step.wordId) : undefined;
      const sentence = entry.step.sentenceId ? sentences.get(entry.step.sentenceId) : undefined;

      return {
        content: entry.step.content,
        kind: entry.step.kind,
        sentence: sentence ? { ...sentence, sentence: sentence.sentence.sentence } : null,
        word: word ? { ...word, ...word.word } : null,
      };
    }),
  );
}

function describeReason(added: readonly Template[]): string {
  const names = added.map((template) => TEMPLATE_NAMES[template]).join(" and ");
  return `Adds ${names} to a language lesson written before language lessons had them, keeping every screen it has.`;
}

/**
 * Writes the pattern table and dialogue a published language lesson lacks, checks them with the
 * language lesson check, and returns the `setScreens` fix that adds them. Nothing is saved: a staff
 * person proposes the fix and another approves it.
 */
export async function draftLanguageActivities({
  analytics,
  lessonId,
}: {
  analytics?: Analytics;
  lessonId: string;
}): Promise<LanguageActivitiesDraft> {
  const lesson = await findLesson(lessonId);
  const skip = findSkipReason(lesson);
  const tip = lesson ? readTip(lesson.steps) : null;
  const inputs = lesson && !skip ? await readLanguageLessonInputs(lessonId) : null;

  if (!lesson || skip || !tip || !inputs) {
    return { lessonId, reason: skip ?? "Has no tip screen.", status: "skipped" };
  }

  // Every screen of a language lesson trains its first skill, and an added question must train one.
  const { skillId } = inputs;

  if (!skillId) {
    return { lessonId, reason: "Has no linked skill.", status: "skipped" };
  }

  const written = await generateLanguageLessonActivities({
    ...inputs.writerInput,
    analytics,
    lesson: {
      sentences: lesson.sentences.map(({ sentence, translation }) => ({
        sentence: sentence.sentence,
        translation,
      })),
      tip,
      words: lesson.words.map(({ translation, word }) => ({ translation, word: word.word })),
    },
  });

  const built = buildLanguageActivities({
    content: cleanLanguageActivities(written.data),
    targetLanguage: inputs.targetLanguage,
  });

  const dropped = Object.entries(built).flatMap(([template, { issues }]) =>
    issues.length > 0 ? [`The ${template} was left out: ${issues.join("; ")}`] : [],
  );

  const activities = {
    ...(built.dialogue.content ? { dialogue: built.dialogue.content } : {}),
    ...(built.patternTable.content ? { patternTable: built.patternTable.content } : {}),
  };

  if (Object.keys(activities).length === 0) {
    return {
      lessonId,
      reason: dropped.length > 0 ? dropped.join(" ") : "Neither a dialogue nor a table fits.",
      status: "skipped",
    };
  }

  const placed = placeActivities({ activities, steps: lesson.steps });

  const { data } = await checkLanguageLesson({
    ...inputs.writerInput,
    analytics,
    screens: toReviewScreens({ lesson, placed }),
    writerModel: written.provenance.model,
  });

  const located = toReviewProblems(data.issues).map(({ problem, screen }) => ({
    entry: screen === null ? undefined : placed[screen],
    problem,
  }));

  const flagged = located.flatMap(({ entry, problem }) =>
    entry && "template" in entry ? [{ problem, template: entry.template }] : [],
  );

  const findings = located.flatMap(({ entry, problem }) =>
    entry && "template" in entry ? [] : [{ problem, stepId: entry?.step.id ?? null }],
  );

  const flaggedTemplates = new Set(flagged.map(({ template }) => template));

  const kept = placed.filter(
    (entry) => !("template" in entry) || !flaggedTemplates.has(entry.template),
  );

  const added = kept.flatMap((entry) => ("template" in entry ? [entry.template] : []));

  const checkDropped = flagged.map(
    ({ problem, template }) => `The check flagged the ${template}: ${problem}`,
  );

  if (added.length === 0) {
    return { lessonId, reason: checkDropped.join(" "), status: "skipped" };
  }

  return {
    added,
    dropped: [...dropped, ...checkDropped],
    findings,
    lessonId,
    reason: describeReason(added),
    setScreens: {
      screens: kept.map((entry) =>
        "step" in entry
          ? { id: entry.step.id }
          : { content: entry.content, kind: "activity", skillId },
      ),
      version: lesson.steps[0]?.version ?? 1,
    },
    status: "drafted",
  };
}
