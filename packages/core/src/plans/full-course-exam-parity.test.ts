import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { findOwnedPlan } from "./_utils/owned-plan";
import { computePlan } from "./_utils/replan";
import { changeGoalPlan } from "./change-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { findPlanTimeToCover } from "./get-time-advice";
import { type BuiltPlan } from "./planner/build-plan";
import { toIsoDate } from "./planner/plan-calendar";
import { parsePlanPhases } from "./planner/plan-state";

const NOW = new Date("2026-10-24T15:00:00Z");
const EXAM = "2027-11-14";
const TIME_ZONE = "America/Sao_Paulo";

function beforeExam(built: BuiltPlan) {
  return built.items
    .filter((item) => item.scheduledFor && toIsoDate(item.scheduledFor) <= EXAM)
    .map((item) => {
      const days = [...(built.lessonDayMinutes.get(item.key) ?? [])].filter(([day]) => day <= EXAM);

      return {
        date: toIsoDate(item.scheduledFor!),
        days,
        key: item.key,
        kind: item.kind,
        minutes:
          days.length > 0 ? days.reduce((sum, [, minutes]) => sum + minutes, 0) : item.minutes,
        phase: item.phase,
        status: item.status,
      };
    });
}

describe("studying everything after an exam (R14)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([100, 30])(
    "keeps Ana's pre-exam schedule at %i minutes a day",
    async (minutes) => {
      const copyKey = randomUUID();

      const copy = await seedV2PersonaCopy({
        copyKey,
        email: `full-course-${copyKey}@zoonk.test`,
        persona: "exam",
      });

      mockSession(copy.userId);

      await expect(
        changeGoalPlan({
          goalId: copy.goalId,
          input: {
            operations: [
              { kind: "setTargetDate", targetDate: EXAM },
              { kind: "setDailyMinutes", minutes },
            ],
            timeZone: TIME_ZONE,
          },
        }),
      ).resolves.toMatchObject({ status: "applied" });

      const owned = await findOwnedPlan({ goalId: copy.goalId });

      if (owned.status !== "ready") {
        throw new Error(`Expected Ana's plan, got ${owned.status}`);
      }

      const { context } = owned;

      const [off, on] = await Promise.all(
        [false, true].map((fullCourse) =>
          computePlan({
            context,
            mode: "forced",
            state: { ...context.state, settings: { ...context.state.settings, fullCourse } },
          }),
        ),
      );

      if (!off || !on) {
        throw new Error("Expected both schedules");
      }

      expect(beforeExam(on.built)).toStrictEqual(beforeExam(off.built));
      expect(off.feasibility.fits).toBe(minutes === 100);
      expect(on.feasibility.fits).toBe(off.feasibility.fits);
      expect(on.built.droppedSkillIds).toStrictEqual([]);

      const foundOff = await findPlanTimeToCover({ goalId: copy.goalId, input: {} });
      expect(foundOff).toMatchObject({ status: "ready", time: { recommendedMinutes: 100 } });

      await expect(
        changeGoalPlan({
          goalId: copy.goalId,
          input: { operations: [{ fullCourse: true, kind: "setFullCourse" }], timeZone: TIME_ZONE },
        }),
      ).resolves.toMatchObject({ status: "applied" });

      await expect(findPlanTimeToCover({ goalId: copy.goalId, input: {} })).resolves.toStrictEqual(
        foundOff,
      );
    },
    120_000,
  );

  it.each([
    { exam: EXAM, fits: true, minutes: 100 },
    { exam: "2026-11-15", fits: false, minutes: 120 },
    { exam: "2026-11-15", fits: false, minutes: 30 },
  ])(
    "keeps Ana's pre-exam challenge skills and minutes at $minutes minutes until $exam",
    async ({ exam, fits, minutes }) => {
      const copyKey = randomUUID();

      const copy = await seedV2PersonaCopy({
        copyKey,
        email: `challenge-parity-${copyKey}@zoonk.test`,
        persona: "exam",
      });

      mockSession(copy.userId);

      await changeGoalPlan({
        goalId: copy.goalId,
        input: {
          operations: [
            { kind: "setTargetDate", targetDate: exam },
            { kind: "setDailyMinutes", minutes },
          ],
          timeZone: TIME_ZONE,
        },
      });

      const owned = await findOwnedPlan({ goalId: copy.goalId });

      if (owned.status !== "ready") {
        throw new Error(`Expected Ana's plan, got ${owned.status}`);
      }

      const { context } = owned;

      const [off, on] = await Promise.all(
        [false, true].map((fullCourse) =>
          computePlan({
            context,
            mode: "forced",
            state: { ...context.state, settings: { ...context.state.settings, fullCourse } },
          }),
        ),
      );

      if (!off || !on) {
        throw new Error("Expected both schedules");
      }

      const challenges = (computed: NonNullable<typeof off>) =>
        computed.built.items
          .filter(
            (item) =>
              item.kind === "boss" && item.scheduledFor && toIsoDate(item.scheduledFor) <= exam,
          )
          .map((item) => ({
            key: item.key,
            minutes: item.minutes,
            skills: computed.itemFacts.get(item.key)?.boss?.testedSkillIds,
          }));

      const before = challenges(off);
      const after = challenges(on);
      expect(before.length).toBeGreaterThan(0);
      expect(after.map(({ skills }) => skills)).toStrictEqual(before.map(({ skills }) => skills));
      expect(after).toStrictEqual(before);
      expect(off.feasibility.fits).toBe(fits);
    },
    120_000,
  );

  it("reads the end the change saved after the exam", async () => {
    const copyKey = randomUUID();

    const copy = await seedV2PersonaCopy({
      copyKey,
      email: `full-course-end-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(copy.userId);

    await expect(
      changeGoalPlan({
        goalId: copy.goalId,
        input: {
          operations: [
            { kind: "setTargetDate", targetDate: "2026-11-15" },
            { fullCourse: true, kind: "setFullCourse" },
          ],
          timeZone: TIME_ZONE,
        },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { goalId: copy.goalId } });
    const end = parsePlanPhases(saved.phases).find((phase) => phase.kind === "afterExam")?.endDate;
    const read = await getGoalPlan(copy.goalId);

    expect(end).toBeDefined();
    expect(read).toMatchObject({ plan: { estimate: { fullCourseEndDate: end } }, status: "ready" });
  }, 120_000);
});
