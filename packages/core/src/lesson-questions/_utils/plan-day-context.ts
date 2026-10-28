import "server-only";
import {
  type PlanItemReason,
  type PlanScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { type TutorLink } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-pages";
import {
  type Goal,
  type PlanItem,
  type PlanItemKind,
  type StudySessionBlock,
  prisma,
} from "@zoonk/db";
import { WEEKLY_CHALLENGE_KINDS } from "../../checkpoints/_utils/load-weekly-challenge";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type PlanItemView, type PlanView } from "../../plans/plan-view-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { isCatchingUp, loadCatchUpItems } from "../../sessions/_utils/catch-up";
import { loadStudySessionView } from "../../sessions/_utils/load-session-view";
import { findSavedDaySession } from "../../sessions/_utils/saved-day-session";
import { type StudyBlockView, type StudySessionView } from "../../sessions/_utils/session-view";
import { type StudySessionRow } from "../../sessions/_utils/study-session-access";
import { readBlockPayload } from "../../sessions/block-payload";
import { getBlockReason } from "./block-reason";

const CATCH_UP_LESSONS = 5;

type PlanScopeItem = NonNullable<PlanScopeContext["today"]>["items"][number];

/** Links acting on the open goal are allowed only in its own conversation; challenge links carry their own plan item. */
export type LinkScope = { activeGoal: boolean };

const TODAY_LINK = { kind: "page", page: "today" } as const satisfies TutorLink;

/** Returns no link outside the open goal's conversation; blocked challenges link their intro instead. */
export function toBlockLink({
  block,
  current,
  scope,
}: {
  block: Pick<StudyBlockView, "id" | "planItemId" | "status" | "waitReason">;
  current: boolean;
  scope: LinkScope;
}): TutorLink | null {
  if (!scope.activeGoal) {
    return null;
  }

  const open = current && (block.status === "pending" || block.status === "active");

  if (open && block.waitReason === null) {
    return { blockId: block.id, kind: "block" };
  }

  return open && block.planItemId
    ? { kind: "challenge", planItemId: block.planItemId }
    : TODAY_LINK;
}

export type SavedDay = {
  lessonTitles: Map<string, string>;
  session: StudySessionRow;
  view: StudySessionView;
};

function toSessionItem({
  block,
  catchUpItems,
  day,
  scope,
  shown,
}: {
  block: StudySessionBlock;
  catchUpItems: readonly PlanItem[];
  day: SavedDay;
  scope: LinkScope;
  shown: StudyBlockView;
}): PlanScopeItem {
  const payload = readBlockPayload(block);
  const lessonTitle = block.lessonId ? day.lessonTitles.get(block.lessonId) : undefined;
  const catchingUp = isCatchingUp({ block, items: catchUpItems });

  return {
    canDo: block.canDo,
    ...(catchingUp && { catchUp: true as const }),
    kind: block.kind,
    link: toBlockLink({ block: shown, current: day.view.current, scope }),
    minutes: block.estimatedMinutes,
    reason: getBlockReason(block),
    status: block.status,
    title: lessonTitle ?? payload.title ?? payload.capsules[0]?.title ?? null,
  };
}

const PLAN_ITEM_REASONS: Record<PlanItemKind, PlanItemReason> = {
  boss: "checkpoint",
  chapter: "newSkill",
  checkpoint: "checkpoint",
  lesson: "newSkill",
  mock: "checkpoint",
  review: "reviewDue",
};

/** Locked mocks remain visible so the tutor can explain Plus access and their replacement full review. */
export function toPlusMark(item: Pick<PlanItemView, "kind" | "requiresPlus">) {
  return item.kind === "mock" && item.requiresPlus ? { plusRequired: true as const } : {};
}

/** Challenge links work before their scheduled day too. */
export function toChallengeLink(item: Pick<PlanItemView, "id" | "kind">): TutorLink | null {
  const challenge = item.kind === "boss" || item.kind === "checkpoint" || item.kind === "mock";
  return challenge && item.id ? { kind: "challenge", planItemId: item.id } : null;
}

function toPlanItem(item: PlanItemView): PlanScopeItem {
  return {
    canDo: null,
    kind: item.kind,
    link: toChallengeLink(item),
    minutes: item.minutes,
    reason: PLAN_ITEM_REASONS[item.kind],
    status: item.status,
    title: item.title,
    ...toPlusMark(item),
  };
}

/** Read-only; null before a saved day exists or while it has no blocks. */
export async function loadSavedDay(goal: Goal): Promise<SavedDay | null> {
  const timeZone = getAnswerTimeZone({ goal });

  const session = await findSavedDaySession({
    goalId: goal.id,
    now: new Date(),
    timeZone,
    userId: goal.userId,
  });

  if (!session || session.blocks.length === 0) {
    return null;
  }

  const lessonIds = session.blocks.flatMap((block) => block.lessonId ?? []);

  const [view, lessons] = await Promise.all([
    loadStudySessionView({ session, timeZone, userId: goal.userId }),
    prisma.lesson.findMany({ select: { id: true, title: true }, where: { id: { in: lessonIds } } }),
  ]);

  return { lessonTitles: new Map(lessons.map(({ id, title }) => [id, title])), session, view };
}

function toToday({
  catchUpItems,
  day,
  plan,
  scope,
}: {
  catchUpItems: readonly PlanItem[];
  day: SavedDay | null;
  plan: PlanView;
  scope: LinkScope;
}): PlanScopeContext["today"] {
  if (day) {
    const shown = new Map(day.view.blocks.map((block) => [block.id, block]));

    return {
      date: toIsoDate(day.session.localDate),
      items: day.session.blocks.flatMap((block) => {
        const view = shown.get(block.id);
        return view ? [toSessionItem({ block, catchUpItems, day, scope, shown: view })] : [];
      }),
      source: "session",
    };
  }

  const planDay = plan.week.days.find((candidate) => candidate.state === "today");

  return planDay
    ? { date: planDay.date, items: planDay.items.map((item) => toPlanItem(item)), source: "plan" }
    : null;
}

function findCatchUpBlock({ day, item }: { day: SavedDay | null; item: PlanItem }) {
  const held = day?.session.blocks.find((block) => isCatchingUp({ block, items: [item] }));
  return held ? day?.view.blocks.find((block) => block.id === held.id) : undefined;
}

/** Catch-up opens only through its saved block or an offered Today action, never through a future standalone lesson. */
function toCatchUpLink({
  block,
  day,
  offeredToday,
  scope,
}: {
  block: StudyBlockView | undefined;
  day: SavedDay | null;
  offeredToday: boolean;
  scope: LinkScope;
}): TutorLink | null {
  if (block && day) {
    return toBlockLink({ block, current: day.view.current, scope });
  }

  if (!scope.activeGoal) {
    return null;
  }

  return offeredToday ? TODAY_LINK : null;
}

export type CatchUpLessons = NonNullable<PlanScopeContext["catchUp"]> & {
  /** Lessons left past the ones named. */
  more: number;
};

/** Links only saved blocks or explicitly offered catch-up actions; no original dates are available for earlier work. */
export async function loadCatchUp({
  day,
  goal,
  items,
  limit = CATCH_UP_LESSONS,
  plan,
  scope,
}: {
  day: SavedDay | null;
  goal: Goal;
  /** The lessons earlier days left, when the caller read them already. */
  items?: readonly PlanItem[];
  limit?: number;
  plan: PlanView;
  scope: LinkScope;
}): Promise<CatchUpLessons | null> {
  const left = items ?? (await loadCatchUpLessons({ goal, plan }));

  if (left.length === 0) {
    return null;
  }

  const shown = left.slice(0, limit);
  const offeredToday = day?.view.catchUp?.later.offered ?? false;

  return {
    lessons: shown.map((item) => {
      const block = findCatchUpBlock({ day, item });

      return {
        inToday: Boolean(block),
        link: toCatchUpLink({ block, day, offeredToday, scope }),
        title: item.titleSnapshot,
      };
    }),
    more: left.length - shown.length,
    offeredToday,
    total: left.length,
  };
}

async function loadCatchUpLessons({ goal, plan }: { goal: Goal; plan: PlanView }) {
  return plan.access.freeWeekOver ? [] : loadCatchUpItems(goal.id);
}

export function toWeeklyChallenge({
  item,
  plan,
}: {
  item: Pick<PlanItem, "id" | "kind" | "scheduledFor">;
  plan: PlanView;
}) {
  const mock = item.kind === "mock";

  return {
    date: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
    kind: mock ? ("mock" as const) : ("weekly" as const),
    link: { kind: "challenge" as const, planItemId: item.id },
    locked: mock && plan.access.mocksRequirePlus,
    when: "date" as const,
  };
}

async function loadChallenges({
  goal,
  plan,
}: {
  goal: Goal;
  plan: PlanView;
}): Promise<NonNullable<PlanScopeContext["challenges"]>> {
  const checkpoint = plan.phases.find((phase) => phase.state === "current")?.checkpoint;

  const weekly = await prisma.planItem.findFirst({
    orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
    select: { id: true, kind: true, scheduledFor: true },
    where: {
      kind: { in: [...WEEKLY_CHALLENGE_KINDS] },
      plan: { goalId: goal.id },
      scheduledFor: { not: null },
      status: "todo",
    },
  });

  return [
    ...(checkpoint?.state === "upcoming"
      ? [
          {
            date: checkpoint.date,
            kind: "challenge" as const,
            link: toChallengeLink({ id: checkpoint.planItemId, kind: "boss" }),
            locked: checkpoint.locked,
            when: checkpoint.when,
          },
        ]
      : []),
    ...(weekly ? [toWeeklyChallenge({ item: weekly, plan })] : []),
  ];
}

function toContextCatchUp(catchUp: CatchUpLessons | null): PlanScopeContext["catchUp"] {
  if (!catchUp) {
    return null;
  }

  const { lessons, offeredToday, total } = catchUp;
  return { lessons, offeredToday, total };
}

export async function loadPlanDayContext({
  goal,
  plan,
  scope,
}: {
  goal: Goal;
  plan: PlanView;
  scope: LinkScope;
}): Promise<Pick<PlanScopeContext, "catchUp" | "challenges" | "today">> {
  const [day, challenges, catchUpItems] = await Promise.all([
    loadSavedDay(goal),
    loadChallenges({ goal, plan }),
    loadCatchUpLessons({ goal, plan }),
  ]);

  return {
    catchUp: toContextCatchUp(await loadCatchUp({ day, goal, items: catchUpItems, plan, scope })),
    challenges,
    today: toToday({ catchUpItems, day, plan, scope }),
  };
}
