import { prisma } from "@zoonk/db";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { repairWrittenGoal } from "./repair-written-preparation";

describe(repairWrittenGoal, () => {
  it("previews, reopens unsupported skills once, and preserves completed work and a continuing draft", async () => {
    const [blueprint, skill, user] = await Promise.all([
      examBlueprintFixture({
        structure: {
          formats: [
            {
              citation: { passage: "", sourceId: "notice" },
              description: "Essay",
              kind: "essay",
              options: null,
            },
          ],
          mock: null,
          rules: [],
          subjects: [],
        },
      }),
      skillFixture({ name: "Build an argument" }),
      userFixture(),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    const [plan, completed, active, learnerSkill] = await Promise.all([
      planFixture({
        goalId: goal.id,
        graph: {
          skills: plannedSkills([skill]).map((row) => ({ ...row, area: "Writing", outcome: true })),
        },
      }),
      studySessionFixture({
        goalId: goal.id,
        localDate: new Date("2026-11-19"),
        status: "completed",
        userId: user.id,
      }),
      studySessionFixture({ goalId: goal.id, localDate: new Date("2026-11-20"), userId: user.id }),
      learnerSkillFixture({ recallDays: 3, skillId: skill.id, state: "mastered", userId: user.id }),
    ]);

    const [item, block, attempt] = await Promise.all([
      planItemFixture({
        kind: "lesson",
        planId: plan.id,
        position: 0,
        skillId: skill.id,
        status: "testedOut",
      }),
      studySessionBlockFixture({
        kind: "produce",
        payload: {
          writing: {
            admissionId: crypto.randomUUID(),
            draft: { revision: 2, text: "Still writing" },
            taskKey: "essay",
            unit: "answer",
          },
        },
        sessionId: active.id,
        status: "active",
      }),
      prisma.attempt.create({
        data: {
          answer: { think: "answer" },
          durationMs: 5000,
          hour: 12,
          isCorrect: true,
          localDate: completed.localDate,
          skillId: skill.id,
          studySessionId: completed.id,
          userId: user.id,
          weekday: 4,
        },
      }),
    ]);

    const request = { goalId: goal.id, userId: user.id };
    await expect(repairWrittenGoal({ ...request, apply: false })).resolves.toBe(1);

    await expect(prisma.planItem.findUnique({ where: { id: item.id } })).resolves.toMatchObject({
      status: "testedOut",
    });

    await expect(repairWrittenGoal({ ...request, apply: true })).resolves.toBe(1);
    await expect(repairWrittenGoal({ ...request, apply: true })).resolves.toBe(0);

    await expect(
      prisma.learnerSkill.findUnique({ where: { id: learnerSkill.id } }),
    ).resolves.toMatchObject({ recallDays: 0, state: "new" });

    await expect(
      prisma.followUp.count({ where: { key: goal.id, kind: "rebuildGoalCurriculum" } }),
    ).resolves.toBe(1);

    await expect(prisma.attempt.findUnique({ where: { id: attempt.id } })).resolves.toStrictEqual(
      attempt,
    );

    await expect(
      prisma.studySession.findUnique({ where: { id: completed.id } }),
    ).resolves.toStrictEqual(completed);

    await expect(
      prisma.studySessionBlock.findUnique({ where: { id: block.id } }),
    ).resolves.toStrictEqual(block);
  });
});
