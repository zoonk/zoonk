import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, onTestFinished } from "vitest";
import { start } from "workflow/api";
import { getWorld } from "workflow/runtime";
import {
  holdPlanLock,
  waitForBlockedStatement,
} from "../../../../../packages/core/src/_test-utils/learner-lock";
import { placeBandChaptersWorkflow } from "../../../mocks/place-band-chapters-workflow";
import { placeChaptersAfterStep } from "./steps/course-outline-steps";

async function waitingPlan(sourceSkillIds: string[]) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  return planFixture({ goalId: goal.id, sourceSkillIds });
}

describe("course outline plan-input conflicts", () => {
  it.each([false, true])(
    "handles arriving dependents with durable execution: %s",
    async (durable) => {
      const [course, first, second, skill] = await Promise.all([
        courseFixture(),
        libraryChapterFixture(),
        libraryChapterFixture(),
        skillFixture(),
      ]);

      await Promise.all([
        courseChapterFixture({ chapterId: first.id, courseId: course.id, position: 0 }),
        courseChapterFixture({ chapterId: second.id, courseId: course.id, position: 1 }),
        prisma.chapterSkill.create({ data: { chapterId: first.id, skillId: skill.id } }),
      ]);

      const plans = await Promise.all([waitingPlan([skill.id]), waitingPlan([]), waitingPlan([])]);

      const [initial, joined, later] = plans;

      const input = {
        courseId: course.id,
        level: "beginner" as const,
        moves: [{ afterChapterId: second.id, chapterId: first.id }],
      };

      if (durable) {
        // The runtime lazily imports the step bundle; load it before holding a database transaction.
        const warmup = await start(placeBandChaptersWorkflow, [{ ...input, moves: [] }]);
        await warmup.returnValue;
      }

      const firstGate = holdPlanLock({ planId: initial!.id });

      onTestFinished(async () => {
        firstGate.release();
        await firstGate.done;
      });

      const firstPid = await firstGate.pid;

      const run = durable ? await start(placeBandChaptersWorkflow, [input]) : null;
      const result = run ? run.returnValue : placeChaptersAfterStep(input);

      const outcome = result.then(
        () => ({ status: "written" as const }),
        (error: unknown) => ({ error, status: "failed" as const }),
      );

      let secondGate: ReturnType<typeof holdPlanLock> | undefined;

      try {
        await waitForBlockedStatement(firstPid, /FROM plans AS plan[\s\S]*FOR UPDATE/u);

        await prisma.plan.update({
          data: { sourceSkillIds: [skill.id] },
          where: { id: joined!.id },
        });

        secondGate = holdPlanLock({ planId: joined!.id });
        const secondPid = await secondGate.pid;
        firstGate.release();
        await firstGate.done;

        await waitForBlockedStatement(secondPid, /FROM plans AS plan[\s\S]*FOR UPDATE/u);

        await prisma.plan.update({
          data: { sourceSkillIds: [skill.id] },
          where: { id: later!.id },
        });
      } finally {
        firstGate.release();
        secondGate?.release();
        await Promise.all([firstGate.done, secondGate?.done]);
        await outcome;
      }

      await expect(outcome).resolves.toMatchObject(
        durable
          ? { status: "written" }
          : { error: { name: "PlanInputWriteConflictError" }, status: "failed" },
      );

      const world = await getWorld();
      const steps = run ? await world.steps.list({ runId: run.runId }) : { data: [] };
      expect(steps.data.map((step) => step.attempt)).toStrictEqual(durable ? [2] : []);

      const placements = await prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(placements.map(({ chapterId }) => chapterId)).toStrictEqual(
        durable ? [second.id, first.id] : [first.id, second.id],
      );

      await Promise.all(
        plans.map((plan) =>
          expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
            inputVersion: plan.inputVersion,
            sourceVersion: plan.sourceVersion + Number(durable),
          }),
        ),
      );
    },
  );
});
