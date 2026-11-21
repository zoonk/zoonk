import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { CGU } from "../exams/mocks/_test-utils/cgu-written";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { listWritingPreparation } from "./writing-preparation";

describe(listWritingPreparation, () => {
  it("prepares the allocated answer and all tasks of the day's 210-minute test", async () => {
    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure: CGU }),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    const timeZone = "UTC";
    const today = getDateInTimeZone({ date: new Date(), timeZone });
    const date = toIsoDate(today);
    const read = () => listWritingPreparation({ goalId: goal.id, timeZone, userId: user.id });

    const answer = {
      date,
      minutes: 140,
      tasks: [{ minutes: 140, taskKey: "long", title: "Long question", unit: "answer" }],
    };

    const test = { date, minutes: 210, tasks: [], test: { day: null, title: "Written test" } };
    const plan = await planFixture({ goalId: goal.id, settings: { writingSchedule: [answer] } });

    await expect(read()).resolves.toMatchObject([{ taskKey: "long", unit: "answer" }]);

    await prisma.plan.update({
      data: { settings: { writingSchedule: [test] } },
      where: { id: plan.id },
    });

    await expect(read()).resolves.toMatchObject([{ taskKey: "short" }, { taskKey: "long" }]);

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: today,
      userId: user.id,
    });

    await studySessionBlockFixture({
      estimatedMinutes: 210,
      kind: "checkpoint",
      payload: {
        checkpoint: {
          kind: "weekly",
          mock: true,
          mockIdentity: { day: null, fullLength: false },
          passMark: 0,
          phase: null,
          rematch: false,
          timeLimitMinutes: 210,
          written: true,
        },
      },
      sessionId: session.id,
    });

    await expect(read()).resolves.toMatchObject([{ taskKey: "short" }, { taskKey: "long" }]);
  });
});
