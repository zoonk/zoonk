import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCurrentUserMemory } from "../memory/get-current-user-memory";
import { getMemoryForTask } from "../memory/get-memory-for-task";
import { updateMemorySettings } from "../memory/update-memory-settings";
import { listGuardedLearners } from "./guardian/list-guarded-learners";
import { revokeGuardianLink } from "./guardian/revoke-guardian-link";
import { setGuardianMemory } from "./guardian/set-guardian-memory";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => {} })),
  headers: vi.fn(async () => new Headers()),
}));

/**
 * Memory profiles how someone learns, and Zoonk works without it, so under-18s and anyone who
 * hasn't told us their age start with it off (ECA Digital art. 7, the UK Children's code standards
 * 7 and 12) and turn it on themselves. A guardian sees whether it's on, never what it holds, and
 * can keep it off (ECA Digital art. 18).
 */

const TEEN_BIRTH = { birthMonth: 1, birthYear: new Date().getUTCFullYear() - 15 };
const ADULT_BIRTH = { birthMonth: 5, birthYear: 1990 };

/** A teen with an accepted guardian who signs in with the invited, verified email. */
async function createGuardedTeen() {
  const [teen, guardian] = await Promise.all([userFixture({ name: "Ana" }), userFixture()]);

  await Promise.all([
    learningProfileFixture({ ...TEEN_BIRTH, userId: teen.id }),
    prisma.user.update({ data: { emailVerified: true }, where: { id: guardian.id } }),
    memoryFactFixture({ category: "goals", statement: "Wants Medicine at UFMG", userId: teen.id }),
  ]);

  const link = await guardianLinkFixture({
    acceptedAt: new Date(),
    guardianEmail: guardian.email,
    status: "active",
    userId: teen.id,
  });

  return { guardian, link, teen };
}

/** A line Zoonk wrote for the learner from their facts, on a lesson's explanation. */
async function writeLine(userId: string) {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });
  const step = await libraryStepFixture({ lessonId: lesson.id });

  return prisma.stepExampleLine.create({
    data: {
      contextKey: "facts-hash",
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      runId: randomUUID(),
      stepId: step.id,
      text: "Como futura médica, 25% de desconto num jaleco de R$ 80 tira R$ 20.",
      userId,
    },
  });
}

function readGoals(userId: string) {
  return getMemoryForTask({ categories: ["goals"], language: "pt", userId });
}

describe("minors' memory", () => {
  it("starts off for a teen and for an unknown age, on for an adult, until they choose", async () => {
    const [teen, unknown, adult] = await Promise.all([userFixture(), userFixture(), userFixture()]);

    await Promise.all([
      learningProfileFixture({ ...TEEN_BIRTH, userId: teen.id }),
      learningProfileFixture({ ...ADULT_BIRTH, userId: adult.id }),
      ...[teen, unknown, adult].map((user) => memoryFactFixture({ userId: user.id })),
    ]);

    for (const [user, enabled] of [
      [teen, false],
      [unknown, false],
      [adult, true],
    ] as const) {
      mockSession(user.id);
      // eslint-disable-next-line no-await-in-loop -- The session mock is shared, so one at a time.
      await expect(getCurrentUserMemory()).resolves.toMatchObject({
        enabled,
        offByGuardian: false,
      });
    }

    await expect(readGoals(teen.id)).resolves.toStrictEqual([]);

    mockSession(teen.id);

    await expect(updateMemorySettings({ enabled: true })).resolves.toStrictEqual({
      enabled: true,
      status: "updated",
    });

    await expect(readGoals(teen.id)).resolves.toHaveLength(1);

    mockSession(adult.id);
    await updateMemorySettings({ enabled: false });
    await expect(readGoals(adult.id)).resolves.toStrictEqual([]);
  });

  it("lets a guardian keep a teen's memory off, see whether it's on and let them choose again", async () => {
    const { guardian, link, teen } = await createGuardedTeen();

    mockSession(teen.id);
    await updateMemorySettings({ enabled: true });
    await writeLine(teen.id);

    mockSession(guardian.id);

    await expect(listGuardedLearners()).resolves.toMatchObject([
      { memoryEnabled: true, memoryOff: false },
    ]);

    await expect(setGuardianMemory({ linkId: link.id, memoryOff: true })).resolves.toStrictEqual({
      status: "updated",
    });

    await expect(listGuardedLearners()).resolves.toMatchObject([
      { memoryEnabled: false, memoryOff: true },
    ]);

    // Off: nothing is read, the lines written from the facts go, and the facts stay theirs to see.
    await expect(readGoals(teen.id)).resolves.toStrictEqual([]);
    await expect(prisma.stepExampleLine.count({ where: { userId: teen.id } })).resolves.toBe(0);

    mockSession(teen.id);

    await expect(getCurrentUserMemory()).resolves.toMatchObject({
      enabled: false,
      facts: [{ statement: "Wants Medicine at UFMG" }],
      offByGuardian: true,
    });

    // The teen can't turn it back on while the guardian keeps it off.
    await expect(updateMemorySettings({ enabled: true })).resolves.toStrictEqual({
      enabled: false,
      status: "updated",
    });

    mockSession(guardian.id);
    await setGuardianMemory({ linkId: link.id, memoryOff: false });

    // Allowed again, the teen's own choice applies.
    await expect(readGoals(teen.id)).resolves.toHaveLength(1);
  });

  it("lifts a guardian's off when the link ends", async () => {
    const { guardian, link, teen } = await createGuardedTeen();

    await prisma.userLearningProfile.update({
      data: { memoryEnabled: true },
      where: { userId: teen.id },
    });

    mockSession(guardian.id);
    await setGuardianMemory({ linkId: link.id, memoryOff: true });
    await expect(readGoals(teen.id)).resolves.toStrictEqual([]);

    await revokeGuardianLink({ linkId: link.id });
    await expect(readGoals(teen.id)).resolves.toHaveLength(1);
  });

  it("keeps other accounts away from a learner's memory", async () => {
    const [{ link, teen }, stranger] = await Promise.all([createGuardedTeen(), userFixture()]);
    await prisma.user.update({ data: { emailVerified: true }, where: { id: stranger.id } });

    mockSession(stranger.id);

    await expect(setGuardianMemory({ linkId: link.id, memoryOff: true })).resolves.toStrictEqual({
      status: "notFound",
    });

    // The learner can't act as their own guardian either.
    await prisma.user.update({ data: { emailVerified: true }, where: { id: teen.id } });
    mockSession(teen.id);

    await expect(setGuardianMemory({ linkId: link.id, memoryOff: false })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(setGuardianMemory({ linkId: link.id, memoryOff: true })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    await expect(
      prisma.guardianLink.findUniqueOrThrow({ where: { id: link.id } }),
    ).resolves.toMatchObject({ memoryOff: false });
  });
});
