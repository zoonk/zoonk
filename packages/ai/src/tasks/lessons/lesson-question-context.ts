/**
 * What the tutor sees when a learner asks, built on the server from stored content and the
 * learner's own records, never from text the client sends. `scope.kind` names the thing asked
 * about: a lesson (all of it, one screen or an answer given on a screen), a chapter, the learner's
 * plan or a mock exam they finished.
 */
export type LessonQuestionStepContext = {
  content: unknown;
  kind: string;
  sentence: {
    explanation: string | null;
    romanization: string | null;
    sentence: string;
    translation: string;
  } | null;
  stepNumber: number;
  word: {
    pronunciation: string | null;
    romanization: string | null;
    translation: string;
    word: string;
  } | null;
};

/** A Library lesson, one of its screens, or an answer given on one. */
export type LessonScopeContext = {
  answer: {
    correctAnswer: string | null;
    feedback: string | null;
    isCorrect: boolean;
    selectedAnswer: string;
  } | null;
  chapter: { description: string | null; title: string };
  course: {
    description: string | null;
    language: string;
    targetLanguage: string | null;
    title: string;
  };
  lesson: { description: string | null; kind: string; language: string; title: string | null };
  lessonSteps: LessonQuestionStepContext[];
  scope: { kind: "answer" | "lesson" | "step" };
  step: LessonQuestionStepContext | null;
  version: 1;
};

/** A chapter, with its lessons and which of them the learner finished. */
export type ChapterScopeContext = {
  chapter: { description: string; level: string; objectives: string[]; title: string };
  course: { title: string } | null;
  language: string;
  lessons: { canDo: string | null; description: string; finished: boolean; title: string }[];
  scope: { kind: "chapter" };
  version: 1;
};

/** A course's outline: what it is and its levels, each with its chapters in order. */
type CourseOutline = {
  description: string | null;
  levels: { chapters: { lessonCount: number; title: string }[]; level: string }[];
  targetLanguage: string | null;
  title: string;
};

/**
 * Why something is in the learner's day: the next new lesson in the plan's order, reviews that
 * are due, practice on their weakest skills or on saved mistakes, extra minutes they asked for,
 * producing (writing or speaking), a short lesson before a checkpoint rematch, or a checkpoint.
 */
export type PlanItemReason =
  | "checkpoint"
  | "extraPractice"
  | "mistakes"
  | "newSkill"
  | "produce"
  | "reinforcement"
  | "reviewDue"
  | "weakArea";

type PlanScopeItem = {
  /** What the learner will be able to do after a lesson. */
  canDo: string | null;
  kind: string;
  minutes: number | null;
  reason: PlanItemReason;
  status: string;
  title: string | null;
};

/**
 * The learner's own plan for a goal: where they are, today's items with reasons, what's next, and
 * the outline of the course it's built from.
 */
export type PlanScopeContext = {
  /** Null when the plan isn't built from a course. */
  course: CourseOutline | null;
  estimate: { endDate: string | null; remainingHours: number };
  goal: { dailyMinutes: number; kind: string; targetDate: string | null; title: string };
  language: string;
  next: { date: string; items: { kind: string; title: string }[] }[];
  phase: {
    chapters: { lessonsDone: number; lessonsTotal: number; state: string; title: string }[];
    endDate: string | null;
    index: number;
    kind: string;
    name: string;
  } | null;
  scope: { kind: "plan" };
  /** Ahead or behind by days, with the fix; the words for it live in the apps. */
  status: {
    days: number | null;
    extraMinutesPerDay: number | null;
    kind: "ahead" | "behind" | "needsAdjusting" | "onTrack";
    options: string[];
  } | null;
  /** From today's session once it's built, otherwise from the plan's items for today. */
  today: { date: string; items: PlanScopeItem[]; source: "plan" | "session" } | null;
  version: 1;
};

type MockScopeRange = { high: number; low: number };

/** A mock exam the learner finished: what it showed and the questions they missed. */
export type MockScopeContext = {
  areas: {
    correct: number;
    /** Only item response theory scales give an area an estimated range. */
    estimate: MockScopeRange | null;
    name: string;
    secondsPerQuestion: number;
    targetSecondsPerQuestion: number | null;
    total: number;
  }[];
  exam: {
    date: string;
    fullLength: boolean;
    name: string | null;
    number: number;
    scoring: string;
    scoringNote: string | null;
  };
  language: string;
  missed: {
    area: string | null;
    correctAnswer: string | null;
    explanation: string | null;
    learnerAnswer: string | null;
    number: number;
    outcome: "blank" | "wrong";
    question: string;
    skill: string | null;
  }[];
  mistakeCauses: { cause: string | null; count: number }[];
  result: {
    blank: number;
    correct: number;
    /** The estimated score as a range; null when the exam's scoring gives none. */
    estimate: MockScopeRange | null;
    minutesUsed: number;
    plannedMinutes: number;
    total: number;
  } | null;
  scope: { kind: "mock" };
  sections: { name: string | null; questions: number }[];
  version: 1;
};

export type LessonQuestionContextSnapshot =
  | ChapterScopeContext
  | LessonScopeContext
  | MockScopeContext
  | PlanScopeContext;
