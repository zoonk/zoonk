import { TodayChangeNotice } from "@repo/packages/learn/src/today/today-change-notice.tsx";
// Today (/today) on a phone for the career goal, from the repo's TodayScreen with a realistic TodayView.
import { TodayScreen } from "@repo/packages/learn/src/today/today-screen.tsx";
import { useEffect } from "react";
import { CAREER_GOAL_ID, S, TabShell, ZU, type ViewProps } from "./common";

const DAY_MS = 86_400_000;
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** The plan's lessons, in order, with the minutes each takes. */
const LESSON_MINUTES = [14, 15, 15, 15, 15, 15];

type Lesson = { title: string; module: string; minutes: number; index: number };

function careerLessons(lang: "en" | "pt"): Lesson[] {
  return S(lang).career.lessons.map(([title, module], index) => ({
    index,
    minutes: LESSON_MINUTES[index] ?? 15,
    module,
    title,
  }));
}

type BlockSpec =
  | { kind: "learn"; lesson: Lesson; status: "pending" | "active" | "completed" }
  | {
      kind: "review";
      minutes: number;
      questions: number;
      topics: string[];
      status: "pending" | "active" | "completed";
    };

function toBlock(spec: BlockSpec, position: number, started: boolean) {
  const base = {
    answered: 0,
    areaId: null,
    areas: [],
    brainPower: spec.status === "completed" ? 14 : 0,
    canDo: null,
    canTestOut: false,
    capsules: [] as {
      format: string;
      key: string;
      lessonId: string | null;
      opened: boolean;
      questions: number;
      title: string;
    }[],
    chapterId: null as string | null,
    checkpoint: null,
    estimatedBrainPower: 15,
    extra: false,
    fullReview: false,
    mistakesOnly: false,
    netScored: false,
    oftenTested: false,
    planItemKey: null,
    position,
    refresh: false,
    reinforcement: false,
    status: spec.status,
    topics: [] as string[],
    waitReason: null,
    weakest: false,
  };

  const block =
    spec.kind === "learn"
      ? {
          ...base,
          chapterId: `chapter-${spec.lesson.module}`,
          estimatedMinutes: spec.lesson.minutes,
          kind: "learn" as const,
          lessonId: `lesson-${spec.lesson.index}`,
          planItemId: `item-${spec.lesson.index}`,
          questions: 8,
          screen: "lesson" as const,
          subject: spec.lesson.module,
          title: spec.lesson.title,
        }
      : {
          ...base,
          capsules: spec.topics.map((title, index) => ({
            format: "flashcards",
            key: `capsule-${index}`,
            lessonId: null,
            opened: false,
            questions: Math.ceil(spec.questions / spec.topics.length),
            title,
          })),
          estimatedMinutes: spec.minutes,
          kind: "review" as const,
          lessonId: null,
          planItemId: null,
          questions: spec.questions,
          screen: "session" as const,
          subject: null,
          title: null,
        };

  return started ? { ...block, id: `block-${position}` } : block;
}

type WeekPlan = {
  date: string;
  kind: "beforeStart" | "study" | "rest";
  minutes: number;
  studied?: boolean;
  hitGoal?: boolean;
}[];

function toWeek({ days, today }: { days: WeekPlan; today: string }) {
  const weekDays = days.map((day) => ({
    date: utc(day.date),
    goalMinutes: day.kind === "study" ? 60 : 0,
    hitGoal: day.hitGoal ?? false,
    isToday: day.date === today,
    kind: day.kind,
    minutes: day.minutes,
    studied: day.studied ?? day.minutes > 0,
  }));

  return {
    days: weekDays,
    nextStudyDate:
      weekDays.find((day) => day.date > utc(today) && day.kind === "study")?.date ?? null,
    time: {
      studiedMinutes: weekDays.reduce((sum, day) => sum + day.minutes, 0),
      targetMinutes: weekDays.reduce((sum, day) => sum + day.goalMinutes, 0),
    },
  };
}

type Mission = {
  kind: string;
  done: number;
  total: number;
  status: "done" | "todo";
  detail?: Record<string, unknown>;
  opens?: unknown;
  minutes?: number;
};

function buildToday({
  blocks: specs,
  catchUp = null,
  date,
  lang,
  missions,
  notice = null,
  planChange = null,
  progressStatus,
  sourceChange = null,
  week,
}: {
  blocks: BlockSpec[];
  catchUp?: {
    positions: number[];
    later: { lessons: number; minutes: number; offered: boolean };
    lessonsLeft: number;
  } | null;
  date: string;
  lang: "en" | "pt";
  missions: (blocks: ReturnType<typeof toBlock>[]) => Mission[];
  notice?: string | null;
  planChange?: unknown;
  progressStatus: unknown;
  sourceChange?: string | null;
  week: WeekPlan;
}) {
  const career = S(lang).career;
  const started = specs.some((spec) => spec.status !== "pending");
  const blocks = specs.map((spec, position) => toBlock(spec, position, started));
  const next = blocks.find((block) => block.status !== "completed") ?? null;
  const done = blocks.filter((block) => block.status === "completed");
  const localDate = utc(date);
  const target = utc(career.date);
  const dayMissions = missions(blocks);

  const session = {
    blocks,
    brainPower: done.reduce((sum, block) => sum + block.brainPower, 0),
    catchUp:
      catchUp &&
      (started ? { ...catchUp, blockIds: catchUp.positions.map((p) => `block-${p}`) } : catchUp),
    current: true,
    dailyLimit: null,
    dayEndsAt: localDate.getTime() + DAY_MS + 3 * 3_600_000,
    emptyDay: null,
    examAccess: { includesMockExams: true, trialEnded: false },
    examTomorrow: false,
    extraTime: { available: false, lessons: [], minutes: 15, reason: "sessionNotFinished" },
    freshStart: null,
    fullMeal: { bonus: 20, earned: dayMissions.every((m) => m.status === "done"), ready: false },
    goalId: CAREER_GOAL_ID,
    hyperdrive: { level: 0, streak: 0 },
    id: "session-1",
    lessonsComing: false,
    lessonsToPrepare: false,
    localDate,
    minutes: {
      dailyGoal: 60,
      done: done.reduce((sum, block) => sum + block.estimatedMinutes, 0),
      planned: blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
    },
    missions: dayMissions,
    nextBlockId: next && started ? `block-${next.position}` : null,
    nextPosition: next?.position ?? null,
    pauseSuggested: false,
    plusLessons: [],
    sessionBar: { completed: done.length, total: blocks.length },
    state: next ? "underway" : "done",
    status: started ? "active" : "unstarted",
    week: toWeek({ days: week, today: date }),
  };

  const daysLeft = Math.round((target.getTime() - localDate.getTime()) / DAY_MS);
  const lessonsDone = 4 + done.length;

  const today = {
    earlierWork: [],
    exam: null,
    examChoice: null,
    goal: {
      dateEstimated: false,
      daysLeft,
      id: CAREER_GOAL_ID,
      kind: "learn",
      targetDate: target,
      title: career.title,
    },
    insight: null,
    lessonStatus: Object.fromEntries(
      blocks.flatMap((block) => (block.lessonId ? [[block.lessonId, "ready"]] : [])),
    ),
    mockFunding: null,
    notice,
    pattern: null,
    planChange,
    progress: {
      lessons: { done: lessonsDone, today: blocks.length - done.length, total: 170 },
      measure: "lessons",
      status: progressStatus,
      value: lessonsDone / 170,
    },
    session,
    shortPlan: null,
    sourceChange,
    studiedToday: done.length > 0,
    suggestedGoal: null,
    uploadRequest: null,
    userId: "learner-1",
    weeklyChallenge: null,
  };

  return { dayMissions, today };
}

function opensBlock(block: ReturnType<typeof toBlock> | undefined) {
  if (!block) {
    return undefined;
  }

  return "id" in block
    ? { blockId: block.id, kind: "block" }
    : {
        kind: "block",
        ref: {
          areaId: null,
          chapterId: block.chapterId,
          checkpoint: null,
          flags: {
            extra: false,
            fullReview: false,
            mistakesOnly: false,
            refresh: false,
            reinforcement: false,
            weakest: false,
          },
          kind: block.kind,
          lessonId: block.lessonId,
          planItemKey: null,
          position: block.position,
        },
      };
}

/** Do a new lesson, finish the chapter the day works on, and ask the buddy something. */
function careerMissions(chapter: string) {
  return (blocks: ReturnType<typeof toBlock>[]): Mission[] => {
    const lessons = blocks.filter((block) => block.kind === "learn");
    const firstNew = lessons.find((block) => block.status !== "completed");
    const chapterBlocks = lessons.filter((block) => block.subject === chapter);
    const chapterNext = chapterBlocks.find((block) => block.status !== "completed");
    const newDone = lessons.some((block) => block.status === "completed");

    return [
      newDone
        ? { done: 1, kind: "somethingNew", status: "done", total: 1 }
        : {
            done: 0,
            kind: "somethingNew",
            minutes: firstNew?.estimatedMinutes,
            opens: opensBlock(firstNew),
            status: "todo",
            total: 1,
          },
      chapterNext
        ? {
            detail: { chapterTitle: chapter },
            done:
              chapterBlocks.length -
              chapterBlocks.filter((block) => block.status !== "completed").length,
            kind: "finishChapter",
            minutes: chapterBlocks
              .filter((block) => block.status !== "completed")
              .reduce((sum, block) => sum + block.estimatedMinutes, 0),
            opens: opensBlock(chapterNext),
            status: "todo",
            total: chapterBlocks.length,
          }
        : {
            detail: { chapterTitle: chapter },
            done: chapterBlocks.length,
            kind: "finishChapter",
            status: "done",
            total: chapterBlocks.length,
          },
      { done: 0, kind: "askBuddy", opens: { kind: "buddy" }, status: "todo", total: 1 },
    ];
  };
}

const ACTIONS = {
  addExtraTime: async () => true,
  adjustTimeHref: "/plan?focus=time",
  answerInsight: async () => true,
  answerSuggestedGoal: async () => true,
  buddyHref: "/buddy",
  catchUp: async () => true,
  challengeHref: (id: string) => `/challenge/${id}`,
  changePlan: async () => null,
  chooseExamOption: async () => null,
  chooseFocusHref: "/plan?focus=choose",
  completedLessonsHref: "/completed-lessons",
  continueHref: null,
  continueSession: async () => true,
  dailyLimitHref: "/settings/appearance",
  decidePlanChange: async () => null,
  examHref: "/exam",
  lessonAgainHref: (id: string) => `/learn/${id}`,
  missionLinks: {
    hrefs: {
      areaPractice: (areaId: string) => `/practice/${areaId}`,
      buddy: "/buddy",
      call: (chapterId: string) => `/call/${chapterId}`,
      mistakesPractice: "/mistakes/practice",
      mockChooser: "/mock/new",
      pattern: (patternId: string) => `/pattern/${patternId}`,
      pronunciation: "/pronunciation",
    },
    openBlock: async () => true,
    openStep: async () => true,
  },
  mistakesHref: "/mistakes",
  openBlock: async () => true,
  plusHref: "/subscription",
  prepareLessons: async () => true,
  refresh: () => {},
  startTestOut: async () => ({ status: "failed" }) as any,
  studyEverythingHref: "/plan?focus=everything",
  summaryHref: "/session",
};

/** Moves the page so a part below the first screen shows, as a learner scrolling to it would. */
function useScrollTo(q: URLSearchParams, selector: string | null) {
  const scroll = q.get("scroll");

  useEffect(() => {
    if (!scroll) {
      return;
    }

    const timer = setTimeout(() => {
      if (/^\d+$/.test(scroll)) {
        window.scrollTo(0, Number(scroll));
        return;
      }

      const target = selector && document.querySelector(selector);
      target?.scrollIntoView({ block: "center" });
    }, 300);

    return () => clearTimeout(timer);
  }, [scroll, selector]);
}

function Screen({
  lang,
  built,
  notices,
}: {
  lang: "en" | "pt";
  built: ReturnType<typeof buildToday>;
  notices?: any;
}) {
  const career = S(lang).career;
  const { dayMissions, today } = built;
  const missionsDone = dayMissions.filter((mission) => mission.status === "done").length;

  return (
    <TabShell
      buddy={{ ...ZU, studiedToday: today.studiedToday }}
      goal={{
        dailyMinutes: career.minutesPerDay,
        id: CAREER_GOAL_ID,
        kind: "learn",
        targetDate: career.date,
        title: career.title,
      }}
      missions={{ done: missionsDone, total: dayMissions.length }}
      tab="today"
    >
      <TodayScreen
        actions={ACTIONS as any}
        brainPower={120}
        buddy={{ ...ZU, studiedToday: today.studiedToday }}
        completedLessons
        missions={{ fullMeal: today.session.fullMeal, missions: dayMissions as any }}
        notices={notices}
        planEnd={career.date}
        readAt={0}
        today={today as any}
      />
    </TabShell>
  );
}

/** Tue, Nov 3: the plan's first day, four lessons, 59 min. `done` finishes that many in order. */
function TodayView({ lang, q }: ViewProps) {
  const lessons = careerLessons(lang);
  const done = Math.max(0, Math.min(4, Number(q.get("done") ?? 0)));

  const built = buildToday({
    blocks: lessons
      .slice(0, 4)
      .map((lesson, index) => ({
        kind: "learn",
        lesson,
        status: index < done ? "completed" : "pending",
      })),
    date: "2026-11-03",
    lang,
    missions: careerMissions(lessons[1]!.module),
    progressStatus: { kind: "onTrack" },
    week: [
      { date: "2026-11-02", kind: "beforeStart", minutes: 0 },
      {
        date: "2026-11-03",
        kind: "study",
        minutes: lessons.slice(0, done).reduce((sum, lesson) => sum + lesson.minutes, 0),
      },
      { date: "2026-11-04", kind: "study", minutes: 0 },
      { date: "2026-11-05", kind: "study", minutes: 0 },
      { date: "2026-11-06", kind: "study", minutes: 0 },
      { date: "2026-11-07", kind: "rest", minutes: 0 },
      { date: "2026-11-08", kind: "rest", minutes: 0 },
    ],
  });

  useScrollTo(q, "[data-slot=today-week]");
  return <Screen built={built} lang={lang} />;
}

/**
 * Thu, Nov 5, after Wednesday was missed (Tuesday stopped at 3 of 4 lessons): the lessons left come
 * first as catch-up, and the two more that don't fit are offered with "Catch up today · +{time}". The notice is the missed day's plan
 * change by default (what the app shows for a missed day); `card=source&msg=…` shows the "What
 * changed" card instead, which the app draws only for a change to the goal's sources.
 */
function TodayChangedView({ lang, q }: ViewProps) {
  const lessons = careerLessons(lang);
  const card = q.get("card") ?? "behind";
  const message = q.get("msg");
  const source = card === "source" && message ? message : null;

  const built = buildToday({
    blocks: [
      {
        kind: "review",
        minutes: 8,
        questions: 10,
        status: "pending",
        topics: [lessons[1]!.title, lessons[2]!.title],
      },
      { kind: "learn", lesson: lessons[3]!, status: "pending" },
      { kind: "learn", lesson: lessons[4]!, status: "pending" },
      { kind: "learn", lesson: lessons[5]!, status: "pending" },
    ],
    catchUp: {
      later: { lessons: 2, minutes: 30, offered: true },
      lessonsLeft: 5,
      positions: [1, 2, 3],
    },
    date: "2026-11-05",
    lang,
    missions: careerMissions(lessons[4]!.module),
    notice: source ? "sourceChange" : card === "behind" ? "planChange" : null,
    planChange:
      card === "behind"
        ? {
            behind: {
              canFocus: true,
              coveredAfter: 0.37,
              coveredBefore: S(lang).career.coverage,
              currentMinutes: 60,
              measure: "goal",
            },
            canApply: false,
            canUndo: false,
            createdAt: "2026-11-05T06:00:00.000Z",
            days: 1,
            effect: null,
            examDocument: "notice",
            id: "change-missed",
            kind: "missedDays",
            lessonsSkipped: 0,
            officialDate: null,
            operations: [],
            reason: null,
            seen: false,
            source: "system",
            status: "applied",
            todaySession: "unchanged",
          }
        : null,
    progressStatus: { days: 1, extraMinutesPerDay: 10, kind: "behind", lessons: 5 },
    sourceChange: source,
    week: [
      { date: "2026-11-02", kind: "beforeStart", minutes: 0 },
      { date: "2026-11-03", kind: "study", minutes: 44 },
      { date: "2026-11-04", kind: "study", minutes: 0 },
      { date: "2026-11-05", kind: "study", minutes: 0 },
      { date: "2026-11-06", kind: "study", minutes: 0 },
      { date: "2026-11-07", kind: "rest", minutes: 0 },
      { date: "2026-11-08", kind: "rest", minutes: 0 },
    ],
  });

  useScrollTo(q, "[data-slot=today-notice]");

  return (
    <Screen
      built={built}
      lang={lang}
      notices={{
        practice: null,
        sourceChange: source ? <TodayChangeNotice message={source} /> : null,
        uploadRequest: null,
      }}
    />
  );
}

export const views: Record<string, (p: ViewProps) => any> = {
  today: TodayView,
  "today-changed": TodayChangedView,
};
