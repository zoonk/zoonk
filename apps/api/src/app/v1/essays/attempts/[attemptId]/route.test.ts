import { randomUUID } from "node:crypto";
import { writingAttemptSchema } from "@zoonk/core/exams/essays/contract";
import { writtenAnswerSchema } from "@zoonk/core/exams/essays/writing-contract";
import { prisma } from "@zoonk/db";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../../../../../../../packages/core/src/_test-utils/mock-session";
import { GET as getAttempt } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

function requestAttempt(attemptId: string) {
  return getAttempt(new Request(`http://localhost/v1/essays/attempts/${attemptId}`), {
    params: Promise.resolve({ attemptId }),
  });
}

describe("GET /v1/essays/attempts/{attemptId}", () => {
  it("validates the ID and returns the writing result only to its owner", async () => {
    const [owner, intruder, skill] = await Promise.all([
      userFixture(),
      userFixture(),
      skillFixture(),
    ]);

    const writing = {
      aspects: [{ criterionId: "claim", description: "Private answer key", points: null }],
      assessedSkillIds: [skill.id],
      criteria: [{ id: "claim", name: "Claim", points: null }],
      grading: { criteria: [], language: null, rounding: null, zeroing: [] },
      keySource: "practiceKey",
      lines: 30,
      minimumWords: 1,
      points: null,
      taskKey: "part-a",
      title: "The response",
      unit: "answer",
    };

    const item = await itemFixture({ content: { writing }, format: "essay", skillId: skill.id });

    const answeredAt = new Date("2026-11-20T18:00:00Z");
    const text = "  This is the response.\n";

    const attempt = await prisma.attempt.create({
      data: {
        answer: {
          conditions: {
            admissionId: randomUUID(),
            estimatedLines: 2,
            origin: "block",
            timed: false,
            version: "firstDraft",
          },
          examBlueprintId: item.examBlueprintId,
          grade: {
            criteria: [],
            errors: [],
            ignoredFrom: null,
            kind: "levels",
            nextStep: null,
            progress: null,
          },
          itemId: item.id,
          text,
          writing: writtenAnswerSchema.shape.writing.parse({ ...writing, part: "Written test" }),
        },
        answeredAt,
        durationMs: 300,
        fromLesson: false,
        hour: 18,
        isCorrect: false,
        itemId: item.id,
        localDate: answeredAt,
        userId: owner.id,
        weekday: 5,
      },
    });

    mockSession(null);
    await expect(requestAttempt(attempt.id)).resolves.toMatchObject({ status: 401 });

    mockSession(intruder.id);
    await expect(requestAttempt(attempt.id)).resolves.toMatchObject({ status: 404 });

    await prisma.item.delete({ where: { id: item.id } });

    mockSession(owner.id);
    await expect(requestAttempt("bad-id")).resolves.toMatchObject({ status: 400 });

    const response = await requestAttempt(attempt.id);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);

    expect(writingAttemptSchema.parse(body)).toMatchObject({
      attemptId: attempt.id,
      grade: { kind: "levels" },
      submittedAt: answeredAt.toISOString(),
      text,
      writing: { taskKey: "part-a" },
    });

    expect(body).not.toHaveProperty("writing.part");
    expect(body).not.toHaveProperty("writing.aspects");
    expect(body).not.toHaveProperty("writing.assessedSkillIds");
    expect(body).not.toHaveProperty("grade.total");
  });
});
