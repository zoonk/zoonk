import { prisma } from "@zoonk/db";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

describe("Buddy thread render reads", () => {
  it("reads a saved plan thread without writing", async () => {
    const { goal, user } = await signedInCourseGoal();

    const thread = await prisma.lessonQuestionThread.create({
      data: { goalId: goal.id, kind: "plan", userId: user.id },
    });

    const counts = await countDatabaseStatements(() =>
      getLessonQuestionThread({ target: { goalId: goal.id, kind: "plan" } }),
    );

    expect(counts.writes).toBe(0);
    expect(counts.result).toMatchObject({ status: "ready", thread: { id: thread.id } });
  });
});
