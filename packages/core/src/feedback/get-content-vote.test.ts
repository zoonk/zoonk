import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getContentVote } from "./get-content-vote";
import { voteOnContent } from "./vote-on-content";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

async function createLibraryStep() {
  const lesson = await libraryLessonFixture();
  return libraryStepFixture({ lessonId: lesson.id });
}

describe(getContentVote, () => {
  it("requires a signed-in learner", async () => {
    const step = await createLibraryStep();
    mockSession(null);

    await expect(
      getContentVote({ contentId: step.id, contentKind: "step" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("reads the learner's own latest vote, with a downvote's reasons and comment", async () => {
    const [user, step] = await Promise.all([userFixture(), createLibraryStep()]);
    const target = { contentId: step.id, contentKind: "step" as const };
    mockSession(user.id);

    await expect(getContentVote(target)).resolves.toStrictEqual({ status: "notVoted" });

    await voteOnContent({ ...target, vote: "up" });

    await voteOnContent({
      ...target,
      comment: "The example skips a step",
      reasons: ["hardToFollow"],
      vote: "down",
    });

    await expect(getContentVote(target)).resolves.toStrictEqual({
      status: "voted",
      vote: {
        ...target,
        comment: "The example skips a step",
        reasons: ["hardToFollow"],
        updatedAt: expect.any(Date),
        vote: "down",
      },
    });
  });

  it("never shows another learner's vote", async () => {
    const [voter, reader, step] = await Promise.all([
      userFixture(),
      userFixture(),
      createLibraryStep(),
    ]);

    mockSession(voter.id);
    await voteOnContent({ contentId: step.id, contentKind: "step", vote: "up" });

    mockSession(reader.id);

    await expect(
      getContentVote({ contentId: step.id, contentKind: "step" }),
    ).resolves.toStrictEqual({ status: "notVoted" });
  });
});
