import { deleteUserDependenciesBeforeAuthDelete } from "@zoonk/auth/account-deletion";
import { prisma } from "@zoonk/db";
import { vi } from "vitest";
import { mockConditionsSchema } from "../../../exams/mocks/mock-contract";
import { getGoalPreparation } from "../../../preparation/get-goal-preparation";
import { getRequestProgressDateContext } from "../../../progress/get-request-date-context";
import { loadPlanChangeView } from "../../_utils/owned-plan";
import { parsePlanChangePayload } from "../../_utils/plan-change-payload";
import { PHASE_DATES_SOURCE } from "../../plan-change-contract";
import { type PlanChangeView } from "../../plan-view-contract";
import { toIsoDate } from "../../planner/plan-calendar";
import { parsePlanGraph, parsePlanPhases, parsePlanSettings } from "../../planner/plan-state";
import { type RulePlan, type RulePreparation } from "../rules/rule-context";
import { type SimViolation } from "./sim-context";
import { type SimLibrary } from "./sim-library";
import { type SimCheck } from "./sim-runner";
import { type SimChange, type SimPlan } from "./sim-world";

const NOON = "T12:00:00Z";

/** The learner's clock: Date (faked by the test file) and the request's local day. */
export function setSimToday(isoDate: string) {
  vi.setSystemTime(new Date(`${isoDate}${NOON}`));

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${isoDate}T00:00:00Z`),
    currentInstant: new Date(`${isoDate}${NOON}`),
    timeZone: "UTC",
  });
}

/**
 * Moves the learner's clock a second on once a step's event is recorded, so what the next event
 * writes comes after it, as in the app: no two of a day's changes share a moment, and the day's
 * latest change is the one made last.
 */
export function tickSimClock() {
  passSimTime(1000);
}

/** Moves the learner's clock on by the time they spent, such as a lesson they played. */
export function passSimTime(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

/** The plan as saved, in the pure tier's shape. */
export async function readSimPlan(goalId: string): Promise<SimPlan> {
  const [goal, plan] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { goalId },
    }),
  ]);

  return {
    coveredShare: plan.coveredShare,
    items: plan.items.map((item) => ({
      chapterId: item.chapterId,
      completedAt: item.completedAt,
      id: item.id,
      kind: item.kind,
      lessonId: item.lessonId,
      lessons: item.lessons,
      phase: item.phase,
      position: item.position,
      scheduledFor: item.scheduledFor,
      skillId: item.skillId,
      status: item.status,
      titleSnapshot: item.titleSnapshot,
    })),
    phases: parsePlanPhases(plan.phases),
    state: {
      goal: {
        dailyMinutes: goal.dailyMinutes,
        targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
      },
      graph: parsePlanGraph(plan.graph),
      settings: parsePlanSettings(plan.settings),
    },
    version: plan.version,
  };
}

/**
 * The plan changes a step wrote or answered (new, or a status that moved), oldest first, and
 * whether a proposal to move the phase dates waits for the learner after it.
 */
export async function readNewChanges({
  planId,
  seen,
}: {
  planId: string;
  /** Each change's status as the last step saw it. */
  seen: Map<string, string>;
}): Promise<{ changes: SimChange[]; views: PlanChangeView[]; waiting: boolean }> {
  const rows = await prisma.planChange.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { planId },
  });

  const fresh = rows.filter((row) => seen.get(row.id) !== row.status);

  for (const row of fresh) {
    seen.set(row.id, row.status);
  }

  const views = await Promise.all(fresh.map((row) => loadPlanChangeView(row.id)));

  const changes = fresh.map((row): SimChange => {
    const payload = parsePlanChangePayload(row.payload);

    return {
      behind: payload.behind,
      day: toIsoDate(row.createdAt),
      effect: payload.effect,
      kind: row.kind,
      operations: payload.operations,
      source: payload.source,
      status: row.status,
    };
  });

  const waiting = rows.some(
    (row) =>
      row.status === "proposed" &&
      parsePlanChangePayload(row.payload).source === PHASE_DATES_SOURCE,
  );

  return { changes, views, waiting };
}

/**
 * The plan's proposals in a status, oldest first, as clients read them: those the learner declined
 * so far, or those still waiting for their answer.
 */
export async function readProposals({
  planId,
  status,
}: {
  planId: string;
  status: "declined" | "proposed";
}): Promise<PlanChangeView[]> {
  const rows = await prisma.planChange.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
    where: { planId, status },
  });

  return Promise.all(rows.map((row) => loadPlanChangeView(row.id)));
}

/** The shared Library rows of a life's copy: `table:id` to the row's last update. */
async function snapshotSharedContent(library: SimLibrary): Promise<Map<string, string>> {
  const { fixture, toId } = library;
  const select = { id: true, updatedAt: true } as const;
  const ids = (rows: readonly (readonly [string, ...unknown[]])[]) => rows.map(([id]) => toId(id));

  const [lessons, skills, courses, chapters, blueprints] = await Promise.all([
    prisma.lesson.findMany({ select, where: { id: { in: ids(fixture.lessons) } } }),
    prisma.skill.findMany({ select, where: { id: { in: ids(fixture.skills) } } }),
    prisma.course.findMany({ select, where: { id: { in: ids(fixture.courses) } } }),
    prisma.chapter.findMany({
      select,
      where: { id: { in: fixture.chapters.map((chapter) => toId(chapter.id)) } },
    }),
    library.blueprintId
      ? prisma.examBlueprint.findMany({ select, where: { id: library.blueprintId } })
      : [],
  ]);

  const tables = { blueprints, chapters, courses, lessons, skills };

  return new Map(
    Object.entries(tables).flatMap(([table, rows]) =>
      rows.map((row) => [`${table}:${row.id}`, row.updatedAt.toISOString()] as const),
    ),
  );
}

/**
 * Owner: "no shared content is removed when a user is deleted": the learner deletes their account
 * at the end of the life, through the cleanup Better Auth runs before it deletes the user. The
 * checks judge only shared content on this step (see `checkRules`).
 */
export async function deleteSimLearner({
  check,
  library,
  plan,
  user,
}: {
  check: SimCheck;
  library: SimLibrary;
  plan: RulePlan;
  user: { email: string; id: string };
}): Promise<SimViolation[]> {
  const before = await snapshotSharedContent(library);
  await deleteUserDependenciesBeforeAuthDelete(user);
  await prisma.user.delete({ where: { id: user.id } });
  const after = await snapshotSharedContent(library);

  const violations = check({
    after: plan,
    before: plan,
    event: { kind: "accountDeleted" },
    sharedContent: { after, before },
    today: new Date(),
  });

  return violations.map((violation) => ({
    ...violation,
    label: "change" as const,
    step: Number.MAX_SAFE_INTEGER,
    today: "deletion",
  }));
}

/** The goal's finished mocks as the score estimate reads them: when, how many questions, what. */
async function readSimMocks(goalId: string): Promise<RulePreparation["mocks"]> {
  const mocks = await prisma.mockExam.findMany({
    orderBy: { finishedAt: "asc" },
    where: { goalId, status: "finished" },
  });

  return mocks.flatMap((mock) => {
    const conditions = mockConditionsSchema.parse(mock.conditions);

    return mock.finishedAt
      ? [
          {
            endedAt: mock.finishedAt,
            questions: conditions.sections.reduce(
              (sum, section) => sum + section.itemIds.length + section.essays.length,
              0,
            ),
            subjectOnly: conditions.shape?.kind === "area",
          },
        ]
      : [];
  });
}

/** The goal's preparation as clients read it, with the mocks the learner finished. */
export async function readSimPreparation(goalId: string): Promise<RulePreparation | undefined> {
  const [result, mocks] = await Promise.all([getGoalPreparation(goalId), readSimMocks(goalId)]);

  if (result.status !== "ready") {
    return undefined;
  }

  const { components, estimatedScore, value } = result.preparation;
  return { components, estimatedScore, mocks, value };
}
