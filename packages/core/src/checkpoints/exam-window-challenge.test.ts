import { type PlanItem, prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSimToday } from "../plans/_test-utils/sim/sim-db-reads";
import { startDbRunner } from "../plans/_test-utils/sim/sim-db-runner";
import { generateSimLife } from "../plans/_test-utils/sim/sim-life-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getCoreLessons } from "../plans/planner/core-first";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { readBlockPayload } from "../sessions/block-payload";
import { requestChallengeQuestions } from "./challenge-questions";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

const MINUTE = 60_000;

/** How many lessons a plan item is: one, or a stand-in's planned size. */
function countLessons(item: PlanItem): number {
  return item.lessonId ? 1 : (item.lessons ?? 1);
}

/**
 * The skills with a core lesson after a challenge's day, counted as the planner counts them: a
 * skill's core is the first third of the lessons the plan's build counted for it (`sizes`, its
 * saved `plannedLessons`), its stand-ins counted by their size, not the graph's estimate.
 */
function listLateSkillIds({
  boss,
  items,
  sizes,
}: {
  boss: PlanItem;
  items: readonly PlanItem[];
  sizes: ReadonlyMap<string, number>;
}): Set<string> {
  const lessons = items.filter((item) => item.kind === "lesson" && item.skillId);
  const bySkill = Map.groupBy(lessons, (item) => item.skillId ?? "");

  return new Set(
    [...bySkill].flatMap(([skillId, own]) => {
      const core = getCoreLessons(
        sizes.get(skillId) ?? own.reduce((sum, item) => sum + countLessons(item), 0),
      );

      const coreItems = own.filter(
        (_, index) => own.slice(0, index).reduce((sum, item) => sum + countLessons(item), 0) < core,
      );

      const late = coreItems.some(
        (item) => item.scheduledFor && boss.scheduledFor && item.scheduledFor > boss.scheduledFor,
      );

      return late ? [skillId] : [];
    }),
  );
}

// Câmara seed 1's first plan: an exam studies in time-boxed windows, and the first window's
// challenge asked four skills begun late in it, whose core lessons come in the next window (R40),
// which then didn't ask them, as they began in the first. A skill's core is the planner's: one the
// graph guessed 26 lessons for has 34 in the Library, so its core is 12, not 9.
describe("an exam window's challenge", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "asks the skills whose core lessons come by its day, each in one window's challenge",
    async () => {
      // A Plus learner, whose exam days outlast the free trial.
      const life = { ...(await generateSimLife({ fixture: "camara", seed: 1 })), subscribed: true };

      const runner = await startDbRunner({
        check: () => [],
        life,
        questions: true,
        reads: { preparation: false, screens: false },
        trace: false,
      });

      const { goal, library } = runner;

      await createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" });

      const items = await prisma.planItem.findMany({
        orderBy: { position: "asc" },
        where: { plan: { goalId: goal.id } },
      });

      // The lessons the build counted for each skill, which the graph's estimate often falls short of.
      const { graph } = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
      const skills = parsePlanGraph(graph).skills;
      const sizes = new Map(skills.map((skill) => [skill.skillId, skill.plannedLessons ?? 0]));

      expect(
        skills.some(
          (skill) => getCoreLessons(skill.plannedLessons ?? 0) > getCoreLessons(skill.lessons),
        ),
      ).toBe(true);

      const boss = items.find((item) => item.kind === "boss" && item.phase === 0);
      const late = boss ? listLateSkillIds({ boss, items, sizes }) : new Set<string>();
      const day = boss?.scheduledFor;

      if (!boss || !day) {
        throw new Error("Expected the first window's challenge, with its day");
      }

      expect(late.size).toBeGreaterThan(0);

      // On its day, after the lessons before it.
      const studied = items.flatMap((item) =>
        item.kind === "lesson" && item.scheduledFor && item.scheduledFor < day ? [item.id] : [],
      );

      await prisma.planItem.updateMany({
        data: { status: "done" },
        where: { id: { in: studied } },
      });

      setSimToday(day.toISOString().slice(0, 10));

      const today = await getTodayStudySession({ goalId: goal.id });
      const blocks = today.status === "ready" ? today.session.blocks : [];
      const duel = blocks.find((block) => block.checkpoint?.phase === 0);
      const row = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: duel?.id } });
      const asked = readBlockPayload(row).skillIds;

      expect(asked.length).toBeGreaterThan(0);
      expect(asked.filter((skillId) => late.has(skillId))).toStrictEqual([]);

      // With none of the window's questions written, its questions are written on those skills.
      await prisma.item.deleteMany({ where: { skillId: { in: [...asked, ...late] } } });

      const writing = await requestChallengeQuestions({ planItemId: boss.id });

      const written =
        writing.status === "start" ? writing.writes.flatMap((write) => write.skillIds) : [];

      expect(written).toHaveLength(10);
      expect(written.filter((skillId) => !asked.includes(skillId))).toStrictEqual([]);

      // The next window's challenge asks those it finished since, and nothing asked before.
      const next = items.find((item) => item.kind === "boss" && item.phase === 1);
      const nextDay = next?.scheduledFor;

      if (!next || !nextDay) {
        throw new Error("Expected the second window's challenge, with its day");
      }

      const finished = [...late].filter(
        (skillId) => !listLateSkillIds({ boss: next, items, sizes }).has(skillId),
      );

      const before = items.flatMap((item) =>
        item.kind === "lesson" && item.scheduledFor && item.scheduledFor < nextDay ? [item.id] : [],
      );

      await prisma.planItem.updateMany({
        data: { status: "done" },
        where: { id: { in: [boss.id, ...before] } },
      });

      setSimToday(nextDay.toISOString().slice(0, 10));

      const later = await getTodayStudySession({ goalId: goal.id });
      const laterBlocks = later.status === "ready" ? later.session.blocks : [];
      const nextDuel = laterBlocks.find((block) => block.checkpoint?.phase === 1);

      const nextRow = await prisma.studySessionBlock.findUniqueOrThrow({
        where: { id: nextDuel?.id },
      });

      const nextAsked = readBlockPayload(nextRow).skillIds;

      const lateForNext = listLateSkillIds({ boss: next, items, sizes });

      expect(finished.length).toBeGreaterThan(0);
      expect(finished.filter((skillId) => !nextAsked.includes(skillId))).toStrictEqual([]);
      expect(nextAsked.filter((skillId) => asked.includes(skillId))).toStrictEqual([]);
      expect(nextAsked.filter((skillId) => lateForNext.has(skillId))).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
