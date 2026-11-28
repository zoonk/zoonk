import {
  type CatchUpView,
  type SessionWeek,
} from "@repo/packages/core/src/sessions/_utils/session-view.ts";
import { BRAIN_POWER_BONUS } from "@repo/packages/core/src/sessions/brain-power.ts";
import { type DayBlockView, type DayView } from "@repo/packages/core/src/sessions/day-view.ts";
import { type Mission } from "@repo/packages/core/src/sessions/missions.ts";
import { type TodayView } from "@repo/packages/core/src/view-models/today/get-today-view.ts";
import { type MissionView } from "@repo/packages/learn/src/missions/mission-links.ts";
import { TodayChangeNotice } from "@repo/packages/learn/src/today/today-change-notice.tsx";
// Today (/today) on a phone for the career goal, from the repo's TodayScreen with a realistic TodayView.
import {
  type TodayActions,
  type TodayHostNotices,
} from "@repo/packages/learn/src/today/today-context.tsx";
import { TodayScreen } from "@repo/packages/learn/src/today/today-screen.tsx";
import { MS_PER_DAY } from "@repo/packages/utils/src/date.ts";
import { useEffect } from "react";
import {
  CAREER_GOAL_ID,
  MISSION_LINKS,
  S,
  TabShell,
  ZU,
  actions,
  noop,
  type ViewProps,
} from "./common";

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
  | { kind: "learn"; lesson: Lesson; status: DayBlockView["status"] }
  | {
      kind: "review";
      minutes: number;
      questions: number;
      topics: string[];
      status: DayBlockView["status"];
    };

function toBlock(spec: BlockSpec, position: number): DayBlockView {
  const base = {
    answered: 0,
    areaId: null,
    areas: [],
    brainPower: spec.status === "completed" ? 14 : 0,
    canDo: null,
    canTestOut: false,
    checkpoint: null,
    estimatedBrainPower: 15,
    extra: false,
    fullReview: false,
    lesson: null,
    mistakesOnly: false,
    netScored: false,
    oftenTested: false,
    opensInPlayer: true,
    planItemKey: null,
    position,
    practiceNumber: null,
    preparing: false,
    refresh: false,
    reinforcement: false,
    status: spec.status,
    topics: [],
    waitReason: null,
    weakest: false,
  };

  if (spec.kind === "learn") {
    return {
      ...base,
      capsules: [],
      chapterId: `chapter-${spec.lesson.module}`,
      estimatedMinutes: spec.lesson.minutes,
      kind: "learn",
      lesson: { setAside: false, status: "ready" },
      lessonId: `lesson-${spec.lesson.index}`,
      planItemId: `item-${spec.lesson.index}`,
      questions: 8,
      screen: "lesson",
      subject: spec.lesson.module,
      title: spec.lesson.title,
    };
  }

  return {
    ...base,
    capsules: spec.topics.map((title, index) => ({
      format: "rapidFire",
      key: `capsule-${index}`,
      lessonId: null,
      opened: false,
      questions: Math.ceil(spec.questions / spec.topics.length),
      title,
    })),
    chapterId: null,
    estimatedMinutes: spec.minutes,
    kind: "review",
    lessonId: null,
    planItemId: null,
    questions: spec.questions,
    screen: "session",
    subject: null,
    title: null,
  };
}

type WeekPlan = {
  date: string;
  kind: "beforeStart" | "study" | "rest";
  minutes: number;
  completed?: number;
  total?: number;
  studied?: boolean;
  hitGoal?: boolean;
}[];

function toWeek({ days, today }: { days: WeekPlan; today: string }): SessionWeek {
  const weekDays = days.map((day) => ({
    completed: day.completed ?? 0,
    date: utc(day.date),
    goalMinutes: day.kind === "study" ? 60 : 0,
    hitGoal: day.hitGoal ?? false,
    isToday: day.date === today,
    kind: day.kind,
    minutes: day.minutes,
    studied: day.studied ?? day.minutes > 0,
    total: day.total ?? 0,
  }));

  return {
    days: weekDays,
    nextStudyDate:
      weekDays.find((day) => day.date > utc(today) && day.kind === "study")?.date ?? null,
  };
}

const blockId = (block: Pick<DayBlockView, "position">) => `block-${block.position}`;

function buildToday({
  blocks: specs,
  catchUp = null,
  date,
  chapter,
  lang,
  notice = null,
  planChange = null,
  progressStatus,
  sourceChange = null,
  week,
}: {
  blocks: BlockSpec[];
  catchUp?: Omit<CatchUpView, "blockIds"> | null;
  date: string;
  /** The chapter the day works on, which a mission asks the learner to finish. */
  chapter: string;
  lang: "en" | "pt";
  notice?: TodayView["notice"];
  planChange?: TodayView["planChange"];
  progressStatus: NonNullable<TodayView["progress"]>["status"];
  sourceChange?: string | null;
  week: WeekPlan;
}): { dayMissions: MissionView[]; today: TodayView } {
  const career = S(lang).career;
  const started = specs.some((spec) => spec.status !== "pending");
  const blocks = specs.map((spec, position) => toBlock(spec, position));
  const next = blocks.find((block) => block.status !== "completed") ?? null;
  const done = blocks.filter((block) => block.status === "completed");
  const localDate = utc(date);
  const target = utc(career.date);
  const planned = blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0);
  const doneMinutes = done.reduce((sum, block) => sum + block.estimatedMinutes, 0);
  const unstartedMissions = careerMissions({ blocks, chapter, opens: unstartedOpens });

  const day = {
    alternativePosition: null,
    brainPower: done.reduce((sum, block) => sum + block.brainPower, 0),
    current: true,
    dayEndsAt: localDate.getTime() + MS_PER_DAY + 3 * 3_600_000,
    emptyDay: null,
    examAccess: { includesMockExams: true, trialEnded: false },
    examTomorrow: false,
    extraTime: {
      available: false as const,
      lessons: [],
      minutes: 15,
      reason: "sessionNotFinished" as const,
    },
    freshStart: null,
    fullMeal: {
      bonus: BRAIN_POWER_BONUS.fullMeal,
      earned: unstartedMissions.every((mission) => mission.status === "done"),
      ready: false,
    },
    goalId: CAREER_GOAL_ID,
    hyperdrive: { level: 0, streak: 0 },
    lessonsComing: false,
    lessonsToPrepare: false,
    localDate,
    minutes: {
      dailyGoal: 60,
      done: doneMinutes,
      left: Math.max(0, planned - doneMinutes),
      planned,
    },
    nextPosition: next?.position ?? null,
    pauseSuggested: false,
    sessionBar: { completed: done.length, total: blocks.length },
    state: next ? ("underway" as const) : ("done" as const),
    week: toWeek({ days: week, today: date }),
  };

  const session: DayView = started
    ? {
        ...day,
        blocks: blocks.map((block) => ({ ...block, id: blockId(block) })),
        catchUp: catchUp && {
          ...catchUp,
          blockIds: catchUp.positions.map((position) => blockId({ position })),
        },
        id: "session-1",
        missions: careerMissions({ blocks, chapter, opens: startedOpens }),
        nextBlockId: next ? blockId(next) : null,
        status: "active",
      }
    : { ...day, blocks, catchUp, missions: unstartedMissions, status: "unstarted" };

  const daysLeft = Math.round((target.getTime() - localDate.getTime()) / MS_PER_DAY);
  const lessonsDone = 4 + done.length;

  const today: TodayView = {
    earlierWork: [],
    exam: null,
    examChoice: null,
    focusTest: null,
    goal: {
      dateEstimated: false,
      daysLeft,
      displayName: career.title,
      examDocument: "notice",
      id: CAREER_GOAL_ID,
      kind: "learn",
      targetDate: target,
      title: career.title,
    },
    insight: null,
    lessonStatus: Object.fromEntries(
      blocks.flatMap((block) => (block.lessonId ? [[block.lessonId, "ready"] as const] : [])),
    ),
    mockFunding: null,
    notice,
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

  return { dayMissions: session.missions, today };
}

const startedOpens = (block: DayBlockView) => ({ blockId: blockId(block), kind: "block" as const });

const unstartedOpens = (block: DayBlockView) => ({
  kind: "block" as const,
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
});

/**
 * Do a new lesson, finish the chapter the day works on, and ask the buddy something. A started day's
 * missions open its blocks by id; an unstarted day's open the work the block will be.
 */
function careerMissions<Opens>({
  blocks,
  chapter,
  opens,
}: {
  blocks: DayBlockView[];
  chapter: string;
  opens: (block: DayBlockView) => Opens;
}): (Omit<Mission, "opens"> & { opens?: Opens | { kind: "buddy" } })[] {
  const lessons = blocks.filter((block) => block.kind === "learn");
  const firstNew = lessons.find((block) => block.status !== "completed");
  const chapterBlocks = lessons.filter((block) => block.subject === chapter);
  const chapterLeft = chapterBlocks.filter((block) => block.status !== "completed");
  const chapterNext = chapterLeft[0];
  const newDone = lessons.some((block) => block.status === "completed");

  return [
    newDone || !firstNew
      ? { done: 1, kind: "somethingNew", status: "done", total: 1 }
      : {
          done: 0,
          kind: "somethingNew",
          minutes: firstNew.estimatedMinutes,
          opens: opens(firstNew),
          status: "todo",
          total: 1,
        },
    chapterNext
      ? {
          detail: { chapterTitle: chapter },
          done: chapterBlocks.length - chapterLeft.length,
          kind: "finishChapter",
          minutes: chapterLeft.reduce((sum, block) => sum + block.estimatedMinutes, 0),
          opens: opens(chapterNext),
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
}

const ACTIONS = actions<TodayActions>({
  adjustTimeHref: "/plan?focus=time",
  buddyHref: "/buddy",
  challengeHref: (id: string) => `/challenge/${id}`,
  chooseFocusHref: "/plan?focus=choose",
  completedLessonsHref: "/completed-lessons",
  continueHref: null,
  examHref: "/exam",
  lessonAgainHref: (id: string) => `/learn/${id}`,
  lessonHref: () => null,
  missionLinks: MISSION_LINKS,
  mistakesHref: "/mistakes",
  plusHref: "/subscription",
  refresh: noop,
  studyEverythingHref: "/plan?focus=everything",
  summaryHref: "/session",
});

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

      const target = selector ? document.querySelector(selector) : null;
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
  notices?: TodayHostNotices;
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
        displayName: career.title,
      }}
      missions={{ done: missionsDone, total: dayMissions.length }}
      tab="today"
    >
      <TodayScreen
        actions={ACTIONS}
        buddy={{ ...ZU, studiedToday: today.studiedToday }}
        completedLessons
        missions={{ fullMeal: today.session.fullMeal, missions: dayMissions }}
        notices={notices}
        planEnd={career.date}
        readAt={0}
        today={today}
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
    chapter: lessons[1]!.module,
    progressStatus: { kind: "onTrack" },
    week: [
      { date: "2026-11-02", kind: "beforeStart", minutes: 0 },
      {
        completed: done,
        date: "2026-11-03",
        kind: "study",
        total: 4,
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
    chapter: lessons[4]!.module,
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
            quote: "missed-2026-11-04",
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
      { completed: 3, date: "2026-11-03", kind: "study", minutes: 44, total: 4 },
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

export const views: Record<string, (p: ViewProps) => React.ReactNode> = {
  today: TodayView,
  "today-changed": TodayChangedView,
};
