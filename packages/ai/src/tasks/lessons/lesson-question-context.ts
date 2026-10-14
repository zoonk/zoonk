import { type TutorLink } from "../v2/tutor/goal-tutor-pages";

/**
 * What the tutor sees when a learner asks, built on the server from stored content and the
 * learner's own records, never from text the client sends. `scope.kind` names the thing asked
 * about: a lesson (all of it, one screen or an answer given on a screen), a chapter, the learner's
 * plan, a subject of their goal, a question of a session or practice, or a mock exam they finished.
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

/**
 * A course's outline: what it is and its levels, each with its chapters' titles in order and
 * whether the plan teaches from it.
 */
type CourseOutline = {
  description: string | null;
  levels: { chapters: string[]; inPlan: boolean; level: string }[];
  targetLanguage: string | null;
  title: string;
};

/**
 * Why something is in the learner's day: the next new lesson in the plan's order, reviews that
 * are due, practice on their weakest skills or on saved mistakes, extra minutes they asked for,
 * producing (writing or speaking), a short lesson before a checkpoint rematch, a checkpoint, or a
 * full review of every topic in place of a mock their plan doesn't include.
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
  /** What the learner will be able to do after a lesson. */
  canDo: string | null;
  /** One of the lessons earlier days left (see `PlanScopeContext.catchUp`): the day opens with it. */
  catchUp?: true;
  kind: string;
  /** Where it opens: today's session's block while it's still to do; null otherwise. */
  link?: TutorLink | null;
  minutes: number | null;
  /**
   * A mock exam the learner's plan doesn't include: it stays on its day and comes with Plus, and
   * the day goes to a full review of every topic in the exam's format instead.
   */
  plusRequired?: true;
  reason: PlanItemReason;
  status: string;
  title: string | null;
};

/**
 * What the exam's notice says, as the app stored it from the notice: the facts the buddy answers
 * from (never from memory) and never contradicts without saying so.
 */
export type ExamFactsContext = {
  /** The exam days: the notice's (`official`), or the likely ones until its notice is out. */
  days: { date: string; label: string | null }[];
  /** Each kind of question, as the notice describes it. */
  formats: string[];
  /**
   * The facts come from the learner's own material (a class test from their teacher's slides or
   * notes), not an official notice.
   */
  fromMaterial: boolean;
  name: string;
  /** Days from a published notice, not an estimate. */
  official: boolean;
  /** The notice's other dates, such as registration and results, with its labels. */
  otherDates: { date: string; label: string }[];
  /** Questions in the whole exam, when the notice says. */
  questionCount: number | null;
  /** Rules that decide the result, as the notice words them: pass marks, eliminations, bonuses. */
  rules: string[];
  /** How the exam is scored, as the notice says. */
  scoring: string | null;
  /**
   * Where the subjects' counts marked `fromLatestEdition` come from: the exam's latest edition, as
   * one source counted it. Absent when the notice counts its subjects itself.
   */
  questionsSource?: { edition: string | null; title: string | null; url: string } | null;
  /** Where the facts come from: the notice's address. */
  source: string | null;
  /**
   * The notice's subjects in its order, with their grouping when it gives one and their questions:
   * the notice's count, or, when it gives none, the count in the exam's latest edition
   * (`fromLatestEdition`), which the plan weighs the subject by and the app shows.
   */
  subjects: {
    fromLatestEdition?: true;
    group: string | null;
    name: string;
    questions: number | null;
  }[];
};

/**
 * The learner's own plan for a goal: where they are, today's items with reasons, what's next, and
 * the outline of the course it's built from.
 */
export type PlanScopeContext = {
  /**
   * Lessons earlier days left that the learner hasn't done yet (the plan's last new-day settling
   * carried them first; see `status.lessons`): the first few by title in the plan's order, each
   * `inToday` when today's session already holds it (the session opens with it), with where it
   * opens, and `total` for all of them. `offeredToday`: Today offers adding the ones today doesn't
   * hold to today with one tap; otherwise the next days open with them. Which day each one came
   * from isn't kept. Null or absent when nothing is left from earlier days.
   */
  catchUp?: {
    lessons: { inToday: boolean; link: TutorLink | null; title: string }[];
    offeredToday: boolean;
    total: number;
  } | null;
  /**
   * The challenges still ahead: the current phase's challenge (`challenge`, the Trickster's duel
   * that closes it) and, for an exam, the next planned mock exam (`mock`), each with its day, when
   * it comes (`date`: on its day; `nextSession`: the learner's next session duels it; `queued`:
   * after the challenge before it), whether starting it needs Plus (`locked`) and where it opens.
   */
  challenges?: {
    date: string | null;
    kind: "challenge" | "mock";
    link: TutorLink | null;
    locked: boolean;
    when: "date" | "nextSession" | "queued";
  }[];
  /** Null when the plan isn't built from a course. */
  course: CourseOutline | null;
  estimate: { endDate: string | null; remainingHours: number };
  /** The exam's facts from its stored notice; absent for other goals and exams without one. */
  exam?: ExamFactsContext | null;
  goal: {
    dailyMinutes: number;
    kind: string;
    /** What the learner said they're aiming for (a score, a course, a position); null without it. */
    target?: string | null;
    /**
     * The last published cut-off of that target, with what it's for and its source: where the bar
     * was, never a promise. Absent when no source published one.
     */
    cutoff?: {
      edition: string | null;
      /**
       * The top of the scale `score` is on: 7 out of 10 reads differently from 7 out of 100.
       * Absent from questions asked before the buddy knew it.
       */
      maxScore?: number;
      quota: string | null;
      score: number;
      source: string;
      target: string;
    } | null;
    targetDate: string | null;
    title: string;
  };
  language: string;
  /** The learner's latest open mistakes in this goal, newest first, for "explain my mistake". */
  mistakes?: {
    answer: string | null;
    correctAnswer: string | null;
    question: string;
    skill: string | null;
  }[];
  /** The next study days, each with its first items and how many more it has. */
  next: {
    date: string;
    /** `link` for a challenge or a mock, whose page opens it before its day. */
    items: { kind: string; link?: TutorLink | null; plusRequired?: true; title: string }[];
    moreItems?: number;
  }[];
  /**
   * The current phase: its chapters still ahead (the current one, then the next few), how many
   * it finished and how many more come after those listed.
   */
  phase: {
    chapters: { lessonsDone: number; lessonsTotal: number; state: string; title: string }[];
    chaptersDone?: number;
    chaptersLater?: number;
    endDate: string | null;
    index: number;
    kind: string;
    name: string;
  } | null;
  scope: { kind: "plan" };
  /**
   * This is the buddy's own conversation about the goal the app has open: its answers may link what
   * acts on the open goal (today's blocks, Today, the Plan and the guide's pages of the open goal).
   * Absent on a screen's questions and for a goal the app doesn't have open.
   */
  selectedGoal?: true;
  /**
   * The page the learner asked from, when it isn't the buddy's own conversation: a chapter, a
   * lesson (one of its screens, or an answer given on one) or a mock exam they finished.
   */
  screen?: TutorScreenContext;
  /**
   * How the learner shaped the plan, so the buddy can say what a change would touch: the plan's
   * areas (focused, given less time, started past their basics or left out), minutes per weekday
   * (Sunday first, 0 for rest days), light weeks, how lessons feel, the level the learner gave and
   * whether their time covers the goal. Missing from plan questions asked before the buddy became
   * the goal's tutor.
   */
  setup?: {
    areas: {
      focused: boolean;
      /** The part of a focused area the learner named ("Biology and Chemistry"); absent when whole. */
      focusPart?: string | null;
      name: string;
      pastBasics?: boolean;
      /** The learner wants less of it: it keeps its core, and its depth goes to other areas first. */
      reduced?: boolean;
      skipped: boolean;
    }[];
    coverage: {
      /** Every topic is in the plan (each skill's core); false only when even the cores don't fit. */
      coreFits?: boolean;
      /** When they don't: the daily minutes that bring every topic in. */
      coreMinutes?: number | null;
      /** The share of everything, in depth, the learner's time covers. */
      coveredShare: number;
      fits: boolean;
      /** "exam": a share of the exam's questions and points; "goal": of the goal's skills. */
      measure: "exam" | "goal";
      recommendedMinutes: number | null;
    } | null;
    difficultyBias: string;
    lightWeeks: { endDate: string; startDate: string }[];
    ownLevel: string | null;
    practiceBias: string;
    weekdayMinutes: number[];
    /** When the exam's written tests are practiced: weekly, biweekly or finalWeeks. */
    writtenCadence?: string | null;
  };
  /**
   * Ahead or behind by days, with the fix, past its date with lessons left (the plan doesn't end:
   * it waits for the learner to adjust it), every lesson done with `challenges` phases' challenges
   * left to win, or finished once every lesson and challenge is; the words for it live in the
   * apps. `lessons`: lessons earlier days left that the learner hasn't caught up on (they come
   * first), when that's why, or the lessons left once the date came.
   */
  status: {
    challenges?: number | null;
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
    lessons?: number | null;
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

/**
 * A subject of the learner's goal (a subject of the exam's notice, or a module of their plan), as
 * its page shows it: its topics in the notice's words with their status, its chapters with their
 * progress, and how much of it they studied, skipped because they knew it, and its size in lessons.
 * `notPlannedReason` says why it, or a topic, is out of the plan; null when it's in.
 */
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
    /** Its questions on the exam, when the notice says. */
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

/**
 * A question of a study session's block or of mistakes practice, as the learner saw it: its text
 * with what it's read with (`set`: a passage, a case, a chart's description) and its options. Once
 * they checked it, `answer` has what they answered, the right answer, whether it was right and
 * why; before that it's null and holds nothing that gives the answer away.
 */
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

/**
 * A page of the app the learner can ask the buddy about, besides their plan. A subject belongs to
 * a goal, and a session's or practice's question comes from one, so they're only ever asked about
 * with that goal's plan.
 */
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
