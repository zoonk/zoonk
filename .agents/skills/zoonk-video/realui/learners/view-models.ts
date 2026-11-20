// A sample learner's screens as the app's own view models, typed against core with no `any`, so a
// contract change fails the type check (npm run typecheck) instead of drawing a wrong screen.
import { type GoalView } from "@repo/packages/core/src/goals/goal-contract.ts";
import {
  type PlanPhaseView,
  type PlanView,
} from "@repo/packages/core/src/plans/plan-view-contract.ts";
import {
  type PlanTimeAdvice,
  type PlanTimeToCover,
} from "@repo/packages/core/src/plans/time-advice-contract.ts";
import {
  type DayBlockView,
  type UnstartedDayView,
} from "@repo/packages/core/src/sessions/day-view.ts";
import {
  type SyllabusSubject,
  type SyllabusView,
} from "@repo/packages/core/src/view-models/syllabus/syllabus-contract.ts";
import { type TodayView } from "@repo/packages/core/src/view-models/today/get-today-view.ts";
import { TODAY } from "../story";
import { type SampleLearner } from "./learners";

const DAY_MS = 86_400_000;
const STUDY_DAYS = [1, 2, 3, 4, 5];
const today = TODAY.slice(0, 10);
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export function goalView(learner: SampleLearner, dailyMinutes = learner.minutesPerDay): GoalView {
  const { goal } = learner;
  return {
    contentCountry: null,
    countryDependent: false,
    createdAt: `${today}T15:00:00.000Z`,
    dailyMinutes,
    details: { answered: [] },
    displayName: goal.displayName,
    examBlueprintId: null,
    examCountry: null,
    examplesCountry: null,
    id: learner.goalId,
    isActive: true,
    kind: goal.kind,
    language: learner.lang,
    languageCountry: null,
    languageFlag: goal.languageFlag,
    plan: null,
    primaryCourseId: null,
    prompt: goal.text,
    regionChoices: [],
    status: "active",
    studyDays: STUDY_DAYS,
    studyTime: null,
    suggested: [],
    targetDate: goal.targetDate,
    targetLanguage: goal.targetLanguage,
    targetRegion: goal.targetRegion,
    timezone: "America/Sao_Paulo",
    title: goal.title,
  };
}

export function timeToCover(learner: SampleLearner): PlanTimeToCover {
  const minutes = learner.everythingMinutes ?? learner.minutesPerDay;
  return {
    fittingDate: null,
    most: null,
    pastDate: false,
    readingNotice: false,
    ready: true,
    recommendedMinutes: minutes,
    suggested: { coveredShare: 1, everyTopic: true, kind: "everything", minutes, split: null },
    targetDate: learner.goal.targetDate,
    targetDateNamedMonth: learner.goal.namedMonth,
  };
}

/** What a daily time covers: the learner's own share at their time, everything at the time that covers it. */
export function timeAdvice(learner: SampleLearner, minutes: number): PlanTimeAdvice {
  const coversAll = learner.everythingMinutes !== null && minutes >= learner.everythingMinutes;
  return {
    coveredShare: coversAll ? 1 : learner.coverage,
    endDate: null,
    focusSubjects: [],
    fullCourseEndDate: null,
    measure: learner.goal.kind === "exam" ? "exam" : "goal",
    numbers: null,
    readingNotice: false,
    ready: true,
    targetDate: learner.goal.targetDate,
    targetDateNamedMonth: learner.goal.namedMonth,
  };
}

function block(learner: SampleLearner, position: number): DayBlockView {
  const lesson = learner.lessons[position];
  if (!lesson) throw new Error(`no lesson ${position}`);
  return {
    answered: 0,
    areaId: null,
    areas: [],
    brainPower: 0,
    canDo: null,
    canTestOut: false,
    capsules: [],
    chapterId: `chapter-${position}`,
    checkpoint: null,
    estimatedBrainPower: 15,
    estimatedMinutes: lesson.minutes,
    extra: false,
    fullReview: false,
    kind: "learn",
    lessonId: `lesson-${position}`,
    mistakesOnly: false,
    netScored: false,
    oftenTested: false,
    opensInPlayer: true,
    planItemId: `item-${position}`,
    planItemKey: null,
    position,
    questions: 8,
    refresh: false,
    reinforcement: false,
    screen: "lesson",
    status: "pending",
    subject: null,
    title: lesson.title,
    topics: [],
    waitReason: null,
    weakest: false,
  };
}

/** The plan's first day, before any lesson: the story's Tuesday, Monday before the plan started. */
export function firstDay(learner: SampleLearner): UnstartedDayView {
  const blocks = learner.lessons.map((_, position) => block(learner, position));
  const localDate = utc(today);
  const monday = localDate.getTime() - (localDate.getUTCDay() - 1) * DAY_MS;
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(monday + offset * DAY_MS);
    const before = date < localDate;
    const weekend = offset >= 5;
    return {
      date,
      goalMinutes: before || weekend ? 0 : learner.minutesPerDay,
      hitGoal: false,
      isToday: date.getTime() === localDate.getTime(),
      kind: before ? ("beforeStart" as const) : weekend ? ("rest" as const) : ("study" as const),
      minutes: 0,
      studied: false,
    };
  });
  const minutes = learner.minutesPerDay;

  return {
    blocks,
    brainPower: 0,
    catchUp: null,
    current: true,
    dayEndsAt: localDate.getTime() + DAY_MS + 3 * 3_600_000,
    emptyDay: null,
    examAccess: { includesMockExams: false },
    examTomorrow: false,
    extraTime: { available: false, lessons: [], minutes: 15, reason: "sessionNotFinished" },
    freshStart: null,
    fullMeal: { bonus: 50, earned: false, ready: false },
    goalId: learner.goalId,
    hyperdrive: { level: 0, streak: 0 },
    lessonsComing: true,
    lessonsToPrepare: false,
    localDate,
    minutes: { dailyGoal: minutes, done: 0, left: minutes, planned: minutes },
    missions: [],
    nextPosition: 0,
    pauseSuggested: false,
    sessionBar: { completed: 0, total: blocks.length },
    state: "underway",
    status: "unstarted",
    week: { days, nextStudyDate: new Date(localDate.getTime() + DAY_MS) },
  };
}

function phase(learner: SampleLearner, index: number): PlanPhaseView {
  const input = learner.phases[index];
  if (!input) throw new Error(`no phase ${index}`);
  return {
    challengeLeftOut: false,
    chapterCount: 0,
    chapters: [],
    // Every planned phase ends with its challenge (core's buildCheckpoint), which makes its end date "~".
    checkpoint: {
      date: input.endDate,
      locked: false,
      planItemId: `boss-${index}`,
      state: "upcoming",
      when: "date",
    },
    endDate: input.endDate,
    hours: 20,
    index,
    kind: "learn",
    lessonsDone: 0,
    lessonsTotal: 0,
    milestone: input.milestone,
    mocks: { count: 0, nextDate: null },
    name: input.name,
    notPlannedReason: null,
    short: null,
    startDate: input.startDate,
    state: index === 0 ? "current" : "upcoming",
  };
}

export function planView(learner: SampleLearner): PlanView {
  const { goal, minutesPerDay } = learner;
  const exam = goal.kind === "exam";
  return {
    access: { mocksRequirePlus: false },
    areas: [],
    bases: null,
    changes: [],
    course: null,
    currentPhase: 0,
    end: null,
    estimate: {
      endDate: goal.targetDate,
      fullCourseEndDate: null,
      pace: { factor: 1, source: "typical" },
      remainingHours: 120,
      totalHours: 120,
    },
    examChoices: learner.choice
      ? [
          {
            group: learner.choice.group,
            leftOut: {
              examPoints: null,
              examQuestions: null,
              name: learner.choice.group,
              points: null,
              questions: null,
            },
            options: learner.choice.options.map((name) => ({ name, shortName: null })),
            subjects: [learner.choice.picked],
            take: 1,
          },
        ]
      : [],
    examDocument: "notice",
    feasibility: {
      coreFits: true,
      coveredShare: learner.coverage,
      deadline: goal.targetDate,
      deepensMostAsked: false,
      fits: false,
      measure: exam ? "exam" : "goal",
      timeCovers: false,
    },
    fitOffer: null,
    focusTest: null,
    fundedMocks: [],
    goalId: learner.goalId,
    languageAim: null,
    notice: null,
    numbers: null,
    ownLevel: null,
    phases: learner.phases.map((_, index) => phase(learner, index)),
    planId: learner.planId,
    ready: true,
    schedule: {
      dailyMinutes: minutesPerDay,
      dailyTimes: [15, 30, 45, 60, 90, 120],
      fullCourse: false,
      lightWeeks: [],
      mocks: null,
      nextSitting: null,
      noSitting: null,
      noticeDay: null,
      shape: {
        canDiffer: true,
        weekdayDays: STUDY_DAYS,
        weekdays: minutesPerDay,
        weekend: null,
        weekendDays: [0, 6],
      },
      studyDays: STUDY_DAYS.length,
      targetDate: goal.targetDate,
      targetDateEstimated: false,
      targetDateNamedMonth: goal.namedMonth,
      weekdayMinutes: [0, 1, 2, 3, 4, 5, 6].map((day) =>
        STUDY_DAYS.includes(day) ? minutesPerDay : 0,
      ),
    },
    shortPlan: null,
    status: { kind: "onTrack" },
    steering: {
      difficultyBias: "standard",
      lessonsStudied: 0,
      practiceBias: "balanced",
      skippedActivities: [],
    },
    tools: [],
    week: { days: [], endDate: today, startDate: today },
    weekTime: { studiedMinutes: 0, targetMinutes: minutesPerDay * STUDY_DAYS.length },
    writtenPractice: null,
  };
}

function subject(input: SampleLearner["subjects"][number], index: number): SyllabusSubject {
  return {
    areas: [input.name],
    chapters: [],
    displayWeight: null,
    group: null,
    imageUrl: null,
    key: `subject-${index}`,
    lessonsDone: 0,
    lessonsKnown: 0,
    lessonsTotal: 0,
    mastery: null,
    matrix: [],
    name: input.name,
    nextDate: null,
    notPlannedReason: null,
    preparation: 0,
    questions: input.questions,
    share: null,
    sharedWith: [],
    shortName: input.shortName,
    source: "notice",
    topicFrequencySource: null,
    // The reveal shows only how many topics a subject has; their names stay folded away.
    topics: Array.from({ length: input.topics }, (_, topic) => ({
      chapters: [],
      frequency: null,
      heading: null,
      name: `${input.shortName} ${topic + 1}`,
      nextDate: null,
      notPlannedReason: null,
      status: null,
    })),
    topicsKnown: 0,
    topicsStudied: 0,
  };
}

/** An exam's subjects as its notice lists them; null for a goal whose plan is a path of phases. */
export function syllabusView(learner: SampleLearner): SyllabusView | null {
  if (learner.subjects.length === 0) return null;
  return {
    courseWeights: null,
    examDocument: "notice",
    fromMaterial: false,
    goal: {
      displayName: learner.goal.displayName,
      id: learner.goalId,
      kind: learner.goal.kind,
      title: learner.goal.title,
    },
    kind: "notice",
    knownTopicsReturn: "practice",
    lessons: { done: 0, known: 0, total: 0 },
    noticeUrl: null,
    passMarks: null,
    questionsSource: null,
    sharedExams: [],
    subjects: learner.subjects.map(subject),
    topicCount: learner.subjects.reduce((sum, { topics }) => sum + topics, 0),
    topicsMapped: true,
    writtenPractice: null,
  };
}

export function todayView(learner: SampleLearner): TodayView {
  const session = firstDay(learner);
  const target = utc(learner.goal.targetDate);
  return {
    earlierWork: [],
    exam: null,
    examChoice: null,
    focusTest: null,
    goal: {
      dateEstimated: false,
      daysLeft: Math.round((target.getTime() - utc(today).getTime()) / DAY_MS),
      displayName: learner.goal.displayName,
      id: learner.goalId,
      kind: learner.goal.kind,
      targetDate: target,
      title: learner.goal.title,
    },
    insight: null,
    lessonStatus: Object.fromEntries(
      session.blocks.flatMap(({ lessonId }) => (lessonId ? [[lessonId, "ready"] as const] : [])),
    ),
    mockFunding: null,
    notice: null,
    pattern: null,
    planChange: null,
    progress: {
      lessons: { done: 0, today: session.blocks.length, total: 160 },
      measure: "lessons",
      status: { kind: "onTrack" },
      value: 0,
    },
    session,
    shortPlan: null,
    sourceChange: null,
    studiedToday: false,
    suggestedGoal: null,
    uploadRequest: null,
    userId: `learner-${learner.goalId}`,
    weeklyChallenge: null,
  };
}
