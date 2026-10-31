import { prisma } from "@zoonk/db";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

describe("Buddy thread render read budget", () => {
  it("reads a saved plan thread", async () => {
    const { goal, user } = await signedInCourseGoal();

    const thread = await prisma.lessonQuestionThread.create({
      data: { goalId: goal.id, kind: "plan", userId: user.id },
    });

    const counts = await countDatabaseStatements(() =>
      getLessonQuestionThread({ target: { goalId: goal.id, kind: "plan" } }),
    );

    assertReadBudget(counts, 6);
    expect(counts.result).toMatchObject({ status: "ready", thread: { id: thread.id } });
  });
});
