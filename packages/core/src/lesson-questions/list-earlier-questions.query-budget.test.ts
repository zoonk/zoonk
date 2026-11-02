import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { hasEarlierQuestions, listEarlierQuestions } from "./list-earlier-questions";

describe("render read budgets", () => {
  it("reads earlier-question presence and both history pages without writing", async () => {
    const user = await userFixture();

    const thread = await prisma.lessonQuestionThread.create({
      data: { kind: "lesson", userId: user.id },
    });

    await prisma.lessonQuestion.createMany({
      data: Array.from({ length: 52 }, (_, index) => ({
        answer: "A saved answer.",
        contextKind: "lesson" as const,
        contextSnapshot: { version: 1 },
        question: `Question ${index}`,
        requestFingerprint: randomUUID(),
        requestId: randomUUID(),
        status: "completed" as const,
        threadId: thread.id,
      })),
    });

    mockSession(user.id);
    const presence = await countDatabaseStatements(hasEarlierQuestions);
    assertReadBudget(presence, 1);
    expect(presence.result).toBe(true);
    const first = await countDatabaseStatements(() => listEarlierQuestions());
    assertReadBudget(first, 1);
    expect(first.result).toMatchObject({ questions: expect.any(Array), status: "ready" });

    if (first.result.status !== "ready" || !first.result.nextCursor) {
      throw new Error("Expected another history page");
    }

    const cursor = first.result.nextCursor;
    expect(first.result.questions).toHaveLength(50);
    const next = await countDatabaseStatements(() => listEarlierQuestions({ cursor }));
    assertReadBudget(next, 2);
    expect(next.result.status === "ready" && next.result.questions).toHaveLength(2);
  });
});
