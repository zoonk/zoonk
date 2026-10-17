import { type MemoryFactText } from "@zoonk/ai/tasks/v2/memory/facts";
import { localizeObject } from "@zoonk/db/seed/v2/localize";
import { listSeedPersonas } from "@zoonk/db/seed/v2/personas";
import { isJsonObject } from "@zoonk/utils/json";

/**
 * Evals read the seed learners on one fixed Monday, so their dates (Ana's exam, Marcos's move)
 * and "next week" never drift between runs.
 */
export const SEED_LEARNERS_TODAY = "2026-09-28";

type SeedLearner = ReturnType<typeof listSeedPersonas>[number];
type SeedGoal = SeedLearner["goal"];
type SeedCourse = SeedGoal["course"];
type SeedLesson = SeedCourse["chapters"][number]["lessons"][number];
type SeedStep = NonNullable<SeedLesson["steps"]>[number];
type SeedAttempt = SeedLearner["attempts"][number];
type SeedLanguage = SeedLearner["language"];

/** An explanation screen of a lesson the learner studies, where a personal example line can go. */
type EvalLearnerScreen = { text: string; title: string };

type EvalLearnerLesson = { key: string; screens: EvalLearnerScreen[]; title: string };

/**
 * A notebook entry as the mistake-cause classifier sees it. The seed's own cause isn't carried:
 * cases label the cause by the classifier's rules.
 */
type EvalLearnerMistake = {
  correctAnswer: string;
  key: string;
  learnerAnswer: string;
  misconception: string;
  question: string;
  recentAccuracy: string;
};

type EvalLearnerGoal = {
  /** The plan's areas as plan edits name them: the chapters' exam areas, else the phases. */
  areas: string[];
  dailyMinutes: number;
  kind: SeedGoal["kind"];
  prompt: string;
  targetDate: string | null;
  title: string;
};

/**
 * One seed learner as the AI tasks that take learner context see them: the goal as typed and
 * planned, what memory holds, the lessons of the goal's course with their teaching screens in the
 * learner's language, and the notebook's mistakes. Maya, Sam and the guest are English speakers;
 * Ana, Lucas, Pedro and Marcos Brazilian Portuguese speakers.
 */
type EvalLearner = {
  facts: MemoryFactText[];
  goal: EvalLearnerGoal;
  key: string;
  language: SeedLanguage;
  lessons: EvalLearnerLesson[];
  mistakes: EvalLearnerMistake[];
};

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getAreas({ goal, language }: { goal: SeedGoal; language: SeedLanguage }): string[] {
  const chapterAreas = goal.course.chapters.flatMap((chapter) =>
    chapter.area ? [chapter.area.in(language)] : [],
  );

  const areas = chapterAreas.length > 0 ? chapterAreas : goal.plan.phases.map(({ name }) => name);

  return [...new Set(areas)];
}

function toGoal({ goal, language }: { goal: SeedGoal; language: SeedLanguage }): EvalLearnerGoal {
  return {
    areas: getAreas({ goal, language }),
    dailyMinutes: goal.dailyMinutes,
    kind: goal.kind,
    prompt: goal.prompt,
    targetDate: goal.targetDate?.toISOString().slice(0, SEED_LEARNERS_TODAY.length) ?? null,
    title: goal.title,
  };
}

function toScreen({ language, step }: { language: SeedLanguage; step: SeedStep }) {
  const content = localizeObject(step.content, language);
  const text = readText(content.text);
  const title = readText(content.title);

  return step.kind === "explanation" && text && title ? [{ text, title }] : [];
}

function toLesson({
  language,
  lesson,
}: {
  language: SeedLanguage;
  lesson: SeedLesson;
}): EvalLearnerLesson[] {
  const screens = (lesson.steps ?? []).flatMap((step) => toScreen({ language, step }));

  if (screens.length === 0) {
    return [];
  }

  return [{ key: lesson.key, screens, title: lesson.title.in(language) }];
}

/** Written lessons of the course, and its quick explanations, in the learner's language. */
function getLessons({ goal, language }: { goal: SeedGoal; language: SeedLanguage }) {
  const { course } = goal;

  if (!course.languages.includes(language)) {
    return [];
  }

  const lessons = [
    ...course.chapters.flatMap((chapter) => chapter.lessons),
    ...(course.explanations ?? []),
  ];

  return lessons.flatMap((lesson) => toLesson({ language, lesson }));
}

/** The learner's answers on the skill, in the words production sends the classifier. */
function getRecentAccuracy({ attempts, skill }: { attempts: SeedAttempt[]; skill: string }) {
  const onSkill = attempts.filter((attempt) => attempt.skill === skill);
  const correct = onSkill.filter((attempt) => attempt.isCorrect).length;

  return `${correct} of ${onSkill.length} right`;
}

function toMistake({
  attempt,
  attempts,
}: {
  attempt: SeedAttempt;
  attempts: SeedAttempt[];
}): EvalLearnerMistake[] {
  const snapshot = attempt.mistake?.snapshot;
  const question = isJsonObject(snapshot) ? readText(snapshot.question) : null;

  if (!attempt.mistake || !isJsonObject(snapshot) || !question) {
    return [];
  }

  return [
    {
      correctAnswer: readText(snapshot.correctAnswer) ?? "",
      key: attempt.key,
      learnerAnswer: readText(snapshot.answer) ?? "",
      misconception: readText(snapshot.misconception) ?? "",
      question,
      recentAccuracy: getRecentAccuracy({ attempts, skill: attempt.skill }),
    },
  ];
}

function toEvalLearner(learner: SeedLearner): EvalLearner {
  const { goal, language } = learner;

  return {
    facts: learner.memory.map(({ category, statement }) => ({ category, statement })),
    goal: toGoal({ goal, language }),
    key: learner.key,
    language,
    lessons: getLessons({ goal, language }),
    mistakes: learner.attempts.flatMap((attempt) =>
      toMistake({ attempt, attempts: learner.attempts }),
    ),
  };
}

const SEED_LEARNERS: readonly EvalLearner[] = listSeedPersonas({
  now: new Date(`${SEED_LEARNERS_TODAY}T12:00:00Z`),
}).map((learner) => toEvalLearner(learner));

/**
 * A seed learner by key ("maya", "ana"). Cases are written against the seed, so a missing
 * learner, lesson or fact means the seed changed and the case must change with it.
 */
export function getSeedLearner(key: string): EvalLearner {
  const learner = SEED_LEARNERS.find((candidate) => candidate.key === key);

  if (!learner) {
    throw new Error(`No seed learner "${key}": update the eval cases that use it`);
  }

  return learner;
}

/** An explanation screen of one of the learner's lessons, by lesson key and screen title. */
export function getSeedScreen({
  learner,
  lessonKey,
  title,
}: {
  learner: EvalLearner;
  lessonKey: string;
  title: string;
}): EvalLearnerScreen {
  const lesson = learner.lessons.find(({ key }) => key === lessonKey);
  const screen = lesson?.screens.find((candidate) => candidate.title === title);

  if (!screen) {
    throw new Error(`Seed learner "${learner.key}" has no screen "${title}" in "${lessonKey}"`);
  }

  return screen;
}

/** One of the learner's memory facts by the words it contains, so cases can point at it. */
export function getSeedFact({
  includes,
  learner,
}: {
  includes: string;
  learner: EvalLearner;
}): MemoryFactText {
  const fact = learner.facts.find(({ statement }) => statement.includes(includes));

  if (!fact) {
    throw new Error(`Seed learner "${learner.key}" has no memory fact with "${includes}"`);
  }

  return fact;
}

export function getSeedMistake({
  key,
  learner,
}: {
  key: string;
  learner: EvalLearner;
}): EvalLearnerMistake {
  const mistake = learner.mistakes.find((candidate) => candidate.key === key);

  if (!mistake) {
    throw new Error(`Seed learner "${learner.key}" has no mistake "${key}"`);
  }

  return mistake;
}
