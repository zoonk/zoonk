import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { replaceMemoryFact } from "./_utils/memory-writes";
import { deleteMemoryFact } from "./delete-memory-fact";
import { undoMemoryChanges } from "./undo-memory-changes";
import { updateMemoryFact } from "./update-memory-fact";
import { updateMemorySettings } from "./update-memory-settings";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

// The sensitivity check after a correction is a paid model call; it runs after the response.
vi.mock("@zoonk/ai/tasks/v2/memory/gate", () => ({ gateMemoryFact: vi.fn() }));

/**
 * Example lines quote what a learner shared ("At the pharmacy where you work…"), so a line must not
 * outlive the fact it could quote: deleting, correcting, replacing or taking back a fact, or turning
 * memory off, lets go of the learner's lines, and never anyone else's.
 */

async function useAdult() {
  const user = await userFixture();
  await learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: user.id });
  mockSession(user.id);
  return user;
}

/** A line Zoonk wrote for the learner from their facts, on a lesson's explanation. */
async function writeLine(
  userId: string,
  text = "At the pharmacy where you work, 25% off saves R$ 10.",
) {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });
  const step = await libraryStepFixture({ lessonId: lesson.id });

  return prisma.stepExampleLine.create({
    data: {
      contextKey: "facts-hash",
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      runId: crypto.randomUUID(),
      stepId: step.id,
      text,
      userId,
    },
  });
}

function countLines(userId: string) {
  return prisma.stepExampleLine.count({ where: { userId } });
}

describe("example lines written from memory", () => {
  it("go when the learner deletes a fact, and other learners keep theirs", async () => {
    const [other, learner] = await Promise.all([userFixture(), useAdult()]);
    const fact = await memoryFactFixture({ statement: "Works at a pharmacy", userId: learner.id });

    await Promise.all([writeLine(learner.id), writeLine(learner.id), writeLine(other.id)]);

    await deleteMemoryFact(fact.id);

    await expect(countLines(learner.id)).resolves.toBe(0);
    await expect(countLines(other.id)).resolves.toBe(1);
  });

  it("go when the learner corrects what a fact says, but not when they only move it", async () => {
    const learner = await useAdult();
    const fact = await memoryFactFixture({ statement: "Works at a pharmacy", userId: learner.id });
    await writeLine(learner.id);

    await updateMemoryFact({ factId: fact.id, input: { category: "background" } });
    await expect(countLines(learner.id)).resolves.toBe(1);

    await updateMemoryFact({ factId: fact.id, input: { statement: "Works at a bakery" } });
    await expect(countLines(learner.id)).resolves.toBe(0);
  });

  it("go when a newer fact replaces one and when an added fact is taken back", async () => {
    const learner = await useAdult();

    const [previous, added] = await Promise.all([
      memoryFactFixture({ statement: "Wants Medicine", userId: learner.id }),
      memoryFactFixture({ category: "context", statement: "Moved to Toronto", userId: learner.id }),
    ]);

    await writeLine(learner.id);

    await replaceMemoryFact({
      fact: {
        category: "goals",
        confidence: 0.9,
        expiresAt: null,
        origin: "said",
        provenance: null,
        sensitive: false,
        source: null,
        statement: "Wants Law",
      },
      previousId: previous.id,
      userId: learner.id,
    });

    await expect(countLines(learner.id)).resolves.toBe(0);

    await writeLine(learner.id, "When you rent in Toronto, 25% off the first month saves 500.");

    await undoMemoryChanges({ changes: [{ factId: added.id, previousFactId: null }] });
    await expect(countLines(learner.id)).resolves.toBe(0);
  });

  it("go when memory is turned off, and turning it on writes nothing back", async () => {
    const learner = await useAdult();
    await writeLine(learner.id);

    await updateMemorySettings({ enabled: true });
    await expect(countLines(learner.id)).resolves.toBe(1);

    await updateMemorySettings({ enabled: false });
    await expect(countLines(learner.id)).resolves.toBe(0);
  });
});
