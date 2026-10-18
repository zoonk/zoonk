import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import { updateLearningProfile } from "../profile/update-learning-profile";
import { getLearnerRevision } from "./get-learner-revision";

describe(getLearnerRevision, () => {
  it("reads the authenticated learner's latest committed revision after every writer", async () => {
    const [learner, other] = await Promise.all([userFixture(), userFixture()]);
    await prisma.user.update({ data: { learnerRevision: 99n }, where: { id: other.id } });
    mockSession(learner.id);

    await updateLearningProfile({ soundsEnabled: false });
    await updateLearningProfile({ soundsEnabled: true });

    await expect(getLearnerRevision()).resolves.toStrictEqual({
      revision: "2",
      userId: learner.id,
    });
  });

  it("keeps a refused or unchanged write's committed revision, including guests", async () => {
    const learner = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: learner.id } });
    mockGuestSession(learner.id);
    await updateLearningProfile({ soundsEnabled: false });
    await updateLearningProfile({ soundsEnabled: false });
    await updateLearningProfile({ activeGoalId: crypto.randomUUID() });

    await expect(getLearnerRevision()).resolves.toStrictEqual({
      revision: "1",
      userId: learner.id,
    });
  });

  it("does not retain an older value within a request", async () => {
    const learner = await userFixture();
    mockSession(learner.id);
    await expect(getLearnerRevision()).resolves.toMatchObject({ revision: "0" });
    await updateLearningProfile({ soundsEnabled: false });
    await expect(getLearnerRevision()).resolves.toMatchObject({ revision: "1" });
  });

  it("has no revision without a session and propagates infrastructure failures", async () => {
    mockSession(null);
    await expect(getLearnerRevision()).resolves.toBeNull();
    const failure = new Error("Session unavailable");
    mockSessionFailure(failure);
    await expect(getLearnerRevision()).rejects.toBe(failure);
  });
});
