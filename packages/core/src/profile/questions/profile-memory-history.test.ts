import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { replaceMemoryFact } from "../../memory/_utils/memory-writes";
import { deleteMemoryFact } from "../../memory/delete-memory-fact";
import { undoMemoryChanges } from "../../memory/undo-memory-changes";
import { answerProfileQuestion } from "./answer-profile-question";
import { getProfileQuestions } from "./get-profile-questions";
import { profileAnswerInputSchema } from "./profile-question-contract";

function saveWatch(pick: "anime" | "comedy") {
  return answerProfileQuestion({
    input: profileAnswerInputSchema.parse({ answer: { picks: [pick] }, question: "watch" }),
    locale: "en",
  });
}

async function tutorReplacement() {
  const user = await userFixture();
  mockSession(user.id);
  await saveWatch("anime");

  const original = await prisma.memoryFact.findFirstOrThrow({
    where: { status: "active", userId: user.id },
  });

  const replaced = await replaceMemoryFact({
    fact: {
      category: "context",
      confidence: 0.8,
      expiresAt: null,
      origin: "said",
      provenance: null,
      sensitive: false,
      source: { id: crypto.randomUUID(), kind: "chat" },
      statement: "Watches documentaries lately",
    },
    previousId: original.id,
    userId: user.id,
  });

  if (!replaced) {
    throw new Error("Expected a tutor replacement");
  }

  return { original, replaced, user };
}

describe("profile answers close stale memory history", () => {
  it("refuses a tutor replacement's undo after a newer profile answer", async () => {
    const { original, replaced, user } = await tutorReplacement();
    await saveWatch("comedy");

    const result = await undoMemoryChanges({
      changes: [{ factId: replaced.fact.id, previousFactId: original.id }],
    });

    expect(result.status).toBe("conflict");
    const view = await getProfileQuestions({ locale: "en" });

    expect(view?.questions.find((question) => question.id === "watch")?.saved.picks).toStrictEqual([
      "comedy",
    ]);

    const old = await prisma.memoryFact.findUniqueOrThrow({ where: { id: original.id } });

    expect(old).toMatchObject({
      deletedAt: expect.any(Date),
      status: "superseded",
      supersededById: null,
    });

    await expect(
      prisma.memoryFact.count({
        where: {
          sourceRef: { equals: "profile", path: ["kind"] },
          status: "active",
          userId: user.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it("restores a deleted tutor fact without restoring the profile answer that a newer save replaced", async () => {
    const { original, replaced } = await tutorReplacement();
    await deleteMemoryFact(replaced.fact.id);
    const deleted = await prisma.memoryFact.findUniqueOrThrow({ where: { id: original.id } });
    await saveWatch("comedy");

    const result = await undoMemoryChanges({
      changes: [{ factId: null, previousFactId: replaced.fact.id }],
    });

    expect(result.status).toBe("undone");
    const old = await prisma.memoryFact.findUniqueOrThrow({ where: { id: original.id } });

    expect(old).toMatchObject({
      deletedAt: deleted.deletedAt,
      status: "superseded",
      supersededById: null,
    });

    const oldTutorUndo = await undoMemoryChanges({
      changes: [{ factId: replaced.fact.id, previousFactId: original.id }],
    });

    expect(oldTutorUndo.status).toBe("conflict");
    const view = await getProfileQuestions({ locale: "en" });

    expect(view?.questions.find((question) => question.id === "watch")?.saved.picks).toStrictEqual([
      "comedy",
    ]);
  });
});
