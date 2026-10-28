import { type TutorLink } from "../v2/tutor/goal-tutor-pages";

/** Built on the server from stored content and the learner's records, never from client text. */
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

export type ChapterScopeContext = {
  chapter: { description: string; level: string; objectives: string[]; title: string };
  course: { title: string } | null;
  language: string;
  lessons: { canDo: string | null; description: string; finished: boolean; title: string }[];
  scope: { kind: "chapter" };
  version: 1;
};

type CourseOutline = {
  description: string | null;
  levels: { chapters: string[]; inPlan: boolean; level: string }[];
  targetLanguage: string | null;
  title: string;
};

/**
 * `reinforcement`: a short lesson before a checkpoint rematch. `fullReview`: every topic, in place
 * of a mock the plan doesn't include.
 */
export type PlanItemReason =
  | "checkpoint"
  | "extraPractice"
  | "fullReview"
  | "mistakes"
  | "newSkill"
  | "produce"
  | "reinforcement"
  | "reviewDue"
  | "weakArea";

type PlanScopeItem = {
  canDo: string | null;
  /** A lesson earlier days left (see `PlanScopeContext.catchUp`): the day opens with it. */
  catchUp?: true;
  kind: string;
  /** Today's session's block while it's still to do; null otherwise. */
  link?: TutorLink | null;
  minutes: number | null;
  /**
   * A mock the plan doesn't include stays on its day with Plus, and the day goes to a full review
   * in the exam's format instead.
   */
  plusRequired?: true;
  reason: PlanItemReason;
  status: string;
  title: string | null;
};

export type ExamFactsContext = {
  /** The notice's (`official`), or the likely ones until its notice is out. */
  days: { date: string; label: string | null }[];
  formats: string[];
  fromMaterial: boolean;
  name: string;
  /** Days from a published notice, not an estimate. */
  official: boolean;
  otherDates: { date: string; label: string }[];
  /** Null when the notice doesn't say. */
  questionCount: number | null;
  rules: string[];
  scoring: string | null;
  /** Where `fromLatestEdition` counts come from; null when the notice counts its own subjects. */
  questionsSource: { edition: string | null; title: string | null; url: string } | null;
  source: string | null;
  /**
   * In the notice's order. Questions are the notice's count or, when it gives none, the latest
   * edition's (`fromLatestEdition`).
   */
  subjects: {
    fromLatestEdition?: true;
    group: string | null;
    name: string;
    questions: number | null;
  }[];
};

export type PlanScopeContext = {
  /**
   * The first few in the plan's order, each `inToday` when today's session holds it, and `total`
   * for all. `offeredToday` when Today offers adding the rest with one tap. Null when nothing is
   * left from earlier days.
   */
  catchUp: {
    lessons: { inToday: boolean; link: TutorLink | null; title: string }[];
    offeredToday: boolean;
    total: number;
  } | null;
  /**
   * When each comes: `date` on its day, `nextSession` in the learner's next session, `queued` after
   * the challenge before it. `locked` when starting it needs Plus.
   */
  challenges: {
    date: string | null;
    kind: "challenge" | "mock" | "weekly";
    link: TutorLink | null;
    locked: boolean;
    when: "date" | "nextSession" | "queued";
  }[];
  /** Null when the plan isn't built from a course. */
  course: CourseOutline | null;
  estimate: { endDate: string | null; remainingHours: number };
  /** Null for other goals and exams without a stored notice. */
  exam: ExamFactsContext | null;
  goal: {
    dailyMinutes: number;
    kind: string;
    target: string | null;
    /** Where the bar was, never a promise. Null when no source published one. */
    cutoff: {
      edition: string | null;
      maxScore: number;
      quota: string | null;
      score: number;
      source: string;
      target: string;
    } | null;
    targetDate: string | null;
    title: string;
  };
  language: string;
  /** Newest first. */
  mistakes: {
    answer: string | null;
    correctAnswer: string | null;
    question: string;
    skill: string | null;
  }[];
  next: {
    date: string;
    items: { kind: string; link?: TutorLink | null; plusRequired?: true; title: string }[];
    moreItems: number;
  }[];
  phase: {
    chapters: { lessonsDone: number; lessonsTotal: number; state: string; title: string }[];
    chaptersDone: number;
    chaptersLater: number;
    endDate: string | null;
    index: number;
    kind: string;
    name: string;
  } | null;
  /**
   * Private Library text is as personal as what the learner wrote and never leaves the app, a web
   * search's words included. Only `false` makes it public; a question saved before this has none.
   */
  privateContent?: boolean;
  scope: { kind: "plan" };
  /**
   * Answers may link what acts on the open goal. Absent on a screen's questions and for a goal the
   * app doesn't have open.
   */
  selectedGoal?: true;
  screen?: TutorScreenContext;
  /** Minutes per weekday start on Sunday, 0 for rest days. Null while the plan is being built. */
  setup: {
    areas: {
      focused: boolean;
      /** Null when the whole area is focused. */
      focusPart: string | null;
      name: string;
      pastBasics: boolean;
      /** The learner wants less of it: it keeps its core, and its depth goes to other areas first. */
      reduced: boolean;
      skipped: boolean;
    }[];
    coverage: {
      /** Every topic is in the plan (each skill's core); false only when even the cores don't fit. */
      coreFits: boolean;
      coveredShare: number;
      fits: boolean;
      /** "exam": a share of the exam's questions and points; "goal": of the goal's skills. */
      measure: "exam" | "goal";
    } | null;
    difficultyBias: string;
    lightWeeks: { endDate: string; startDate: string }[];
    ownLevel: string | null;
    practiceBias: string;
    weekdayMinutes: number[];
    /** When the exam's written tests are practiced: weekly, biweekly or finalWeeks. */
    writtenCadence: string | null;
  } | null;
  /**
   * Past its date with lessons left, the plan doesn't end: it waits for the learner to adjust it.
   * The words for each status live in the apps.
   */
  status: {
    challenges: number | null;
    days: number | null;
    extraMinutesPerDay: number | null;
    kind:
      | "ahead"
      | "behind"
      | "challengesLeft"
      | "finished"
      | "needsAdjusting"
      | "onTrack"
      | "pastDate";
    lessons: number | null;
    options: string[];
  } | null;
  /** From today's session once it's built, otherwise from the plan's items for today. */
  today: { date: string; items: PlanScopeItem[]; source: "plan" | "session" } | null;
  version: 1;
};

type MockScopeRange = { high: number; low: number };

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
    /** `partial`: a question with several picks that earned part of its points. */
    outcome: "blank" | "partial" | "wrong";
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

/** `notPlannedReason` says why it, or a topic, is out of the plan; null when it's in. */
export type SubjectScopeContext = {
  chapters: {
    lessonsDone: number;
    lessonsTotal: number;
    nextDate: string | null;
    state: string;
    title: string;
  }[];
  language: string;
  scope: { kind: "subject" };
  subject: {
    lessonsDone: number;
    lessonsKnown: number;
    lessonsTotal: number;
    name: string;
    nextDate: string | null;
    notPlannedReason: string | null;
    /** Null when the notice doesn't say. */
    questions: number | null;
    /** `notice`: a subject of the exam's notice; `plan`: a module of the plan. */
    source: string;
  };
  topics: {
    name: string;
    nextDate: string | null;
    notPlannedReason: string | null;
    status: string | null;
  }[];
  version: 1;
};

/** `answer` is null until the learner checks it, and nothing before then gives the answer away. */
export type ItemScopeContext = {
  answer: {
    correctAnswer: string | null;
    explanation: string | null;
    isCorrect: boolean;
    learnerAnswer: string | null;
  } | null;
  language: string;
  question: { format: string; options: string[]; text: string };
  scope: { kind: "item" };
  set: string | null;
  skill: string | null;
  version: 1;
};

/** Subjects and session questions belong to a goal, so they're only asked about with its plan. */
export type TutorScreenContext =
  | ChapterScopeContext
  | ItemScopeContext
  | LessonScopeContext
  | MockScopeContext
  | SubjectScopeContext;

export type LessonQuestionContextSnapshot =
  | ChapterScopeContext
  | LessonScopeContext
  | MockScopeContext
  | PlanScopeContext;
