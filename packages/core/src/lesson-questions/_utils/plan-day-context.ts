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
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type PlanItemView, type PlanView } from "../../plans/plan-view-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { loadCatchUpItems } from "../../sessions/_utils/catch-up";
import { loadStudySessionView } from "../../sessions/_utils/load-session-view";
import { findSavedDaySession } from "../../sessions/_utils/saved-day-session";
import { type StudyBlockView, type StudySessionView } from "../../sessions/_utils/session-view";
import { type StudySessionRow } from "../../sessions/_utils/study-session-access";
import { readBlockPayload } from "../../sessions/block-payload";
import { getBlockReason } from "./block-reason";

/** The first lessons earlier days left, by title; the rest only count (see `catchUp.total`). */
const CATCH_UP_LESSONS = 5;

type PlanScopeItem = NonNullable<PlanScopeContext["today"]>["items"][number];

/**
 * What the buddy may link for this goal: the links that act on the goal the app has open (today's
 * blocks, Today, the Plan and its subjects) only in the buddy's own conversation about that goal,
 * whose page always shows the open goal's thread, so a link never opens another goal's day, even
 * read again after the learner switched goals. A challenge's page is its own plan item's, whatever
 * goal is open.
 */
export type LinkScope = { activeGoal: boolean };

const TODAY_LINK = { kind: "page", page: "today" } as const satisfies TutorLink;

/**
 * Where a block of the learner's day opens: itself, as Today opens it, while it's still to do and
 * nothing in the day holds it back; a challenge that waits for earlier work, its page; anything
 * else, Today. Nothing outside the open goal's conversation (see `LinkScope`).
 */
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

/** The learner's day, as Today shows it, with the lesson titles its learn blocks teach. */
export type SavedDay = {
  lessonTitles: Map<string, string>;
  session: StudySessionRow;
  view: StudySessionView;
};

function toSessionItem({
  block,
  day,
  scope,
  shown,
}: {
  block: StudySessionBlock;
  day: SavedDay;
  scope: LinkScope;
  /** The block as Today shows it. */
  shown: StudyBlockView;
}): PlanScopeItem {
  const payload = readBlockPayload(block);
  const lessonTitle = block.lessonId ? day.lessonTitles.get(block.lessonId) : undefined;
  const catchingUp = day.view.catchUp?.blockIds.includes(block.id) ?? false;

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

/**
 * A mock exam the learner's plan doesn't include stays on its day, marked: features are never
 * hidden, so the buddy can say it comes with Plus when asked about it, and that the day is a full
 * review of every topic instead.
 */
export function toPlusMark(item: Pick<PlanItemView, "kind" | "requiresPlus">) {
  return item.kind === "mock" && item.requiresPlus ? { plusRequired: true as const } : {};
}

/** A challenge or a planned mock opens on its page, before its day too. */
export function toChallengeLink(item: Pick<PlanItemView, "id" | "kind">): TutorLink | null {
  const challenge = item.kind === "boss" || item.kind === "checkpoint" || item.kind === "mock";
  return challenge ? { kind: "challenge", planItemId: item.id } : null;
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

/**
 * The learner's day as Today opens it (the session from before midnight they're still in, or
 * today's), read as Today's queue shows it: its visible blocks, which of them catch up, and the
 * lessons its learn blocks teach. Null while the day isn't built or has no blocks: nothing here
 * builds it.
 */
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

/** Today's session once it's built, as Today shows it; until then, what the plan gives the day. */
function toToday({
  day,
  plan,
  scope,
}: {
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
        return view ? [toSessionItem({ block, day, scope, shown: view })] : [];
      }),
      source: "session",
    };
  }

  const planDay = plan.week.days.find((candidate) => candidate.state === "today");

  return planDay
    ? { date: planDay.date, items: planDay.items.map((item) => toPlanItem(item)), source: "plan" }
    : null;
}

/** Today's block that teaches a lesson earlier days left, when the day holds it. */
function findCatchUpBlock({ day, item }: { day: SavedDay | null; item: PlanItem }) {
  const catchUpIds = new Set(day?.view.catchUp?.blockIds);

  return day?.view.blocks.find(
    (block) =>
      catchUpIds.has(block.id) &&
      (block.planItemId === item.id ||
        (item.lessonId !== null && block.lessonId === item.lessonId)),
  );
}

/** Where a lesson earlier days left opens: today's block that holds it, or else Today. */
function toCatchUpLink({
  block,
  day,
  scope,
}: {
  block: StudyBlockView | undefined;
  day: SavedDay | null;
  scope: LinkScope;
}): TutorLink | null {
  if (block && day) {
    return toBlockLink({ block, current: day.view.current, scope });
  }

  return scope.activeGoal ? TODAY_LINK : null;
}

/** The lessons earlier days left, as the buddy reads them (see `loadCatchUp`). */
export type CatchUpLessons = NonNullable<PlanScopeContext["catchUp"]> & {
  /** Lessons left past the ones named. */
  more: number;
};

/**
 * The lessons earlier days left, from the same rows the plan's status counts (`loadCatchUpItems`):
 * the first `limit` by title, each linked to today's block when the day holds it, and to Today
 * otherwise, where the day either offers catching up (`offeredToday`) or the next days open with
 * them. No original day: the plan keeps only that earlier days left them. A free exam plan past
 * its first week has none, as its status says. The context names the first few; the buddy's
 * `catchUp` lookup names more.
 */
export async function loadCatchUp({
  day,
  goal,
  limit = CATCH_UP_LESSONS,
  plan,
  scope,
}: {
  day: SavedDay | null;
  goal: Goal;
  limit?: number;
  plan: PlanView;
  scope: LinkScope;
}): Promise<CatchUpLessons | null> {
  // A free exam plan past its first week has no new lessons, so nothing to catch up on.
  const items = plan.access.freeWeekOver ? [] : await loadCatchUpItems(goal.id);

  if (items.length === 0) {
    return null;
  }

  const shown = items.slice(0, limit);

  return {
    lessons: shown.map((item) => {
      const block = findCatchUpBlock({ day, item });

      return {
        inToday: Boolean(block),
        link: toCatchUpLink({ block, day, scope }),
        title: item.titleSnapshot,
      };
    }),
    more: items.length - shown.length,
    offeredToday: day?.view.catchUp?.later.offered ?? false,
    total: items.length,
  };
}

/**
 * The challenges still ahead: the current phase's challenge, as the plan shows when it comes, and
 * an exam's next planned mock, by its day. Their pages open them, whatever goal is open.
 */
async function loadChallenges({
  goal,
  plan,
}: {
  goal: Goal;
  plan: PlanView;
}): Promise<NonNullable<PlanScopeContext["challenges"]>> {
  const checkpoint = plan.phases.find((phase) => phase.state === "current")?.checkpoint;

  const mock =
    goal.kind === "exam"
      ? await prisma.planItem.findFirst({
          orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
          select: { id: true, scheduledFor: true },
          where: {
            kind: "mock",
            plan: { goalId: goal.id },
            scheduledFor: { not: null },
            status: "todo",
          },
        })
      : null;

  return [
    ...(checkpoint?.state === "upcoming"
      ? [
          {
            date: checkpoint.date,
            kind: "challenge" as const,
            link: { kind: "challenge" as const, planItemId: checkpoint.planItemId },
            locked: checkpoint.locked,
            when: checkpoint.when,
          },
        ]
      : []),
    ...(mock
      ? [
          {
            date: mock.scheduledFor ? toIsoDate(mock.scheduledFor) : null,
            kind: "mock" as const,
            link: { kind: "challenge" as const, planItemId: mock.id },
            locked: plan.access.mocksRequirePlus,
            when: "date" as const,
          },
        ]
      : []),
  ];
}

/** The context's catch-up: the first few lessons and how many in all. */
function toContextCatchUp(catchUp: CatchUpLessons | null): PlanScopeContext["catchUp"] {
  if (!catchUp) {
    return null;
  }

  const { lessons, offeredToday, total } = catchUp;
  return { lessons, offeredToday, total };
}

/**
 * The learner's day as the buddy reads it, from what Today itself reads: today's items (the saved
 * day's blocks, or the plan's items until it's built), the lessons earlier days left and the
 * challenges ahead, each with where it opens (see `LinkScope`).
 */
export async function loadPlanDayContext({
  goal,
  plan,
  scope,
}: {
  goal: Goal;
  plan: PlanView;
  scope: LinkScope;
}): Promise<Pick<PlanScopeContext, "catchUp" | "challenges" | "today">> {
  const [day, challenges] = await Promise.all([loadSavedDay(goal), loadChallenges({ goal, plan })]);

  return {
    catchUp: toContextCatchUp(await loadCatchUp({ day, goal, plan, scope })),
    challenges,
    today: toToday({ day, plan, scope }),
  };
}
