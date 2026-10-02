import { trackServerEvent, trackSystemEvent } from "@zoonk/core/analytics/server";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { trackGenerationFailedStep } from "./generation-failed-step";

// PostHog is an external service; the mock records what would leave the server.
vi.mock("@zoonk/core/analytics/server", () => ({
  trackServerEvent: vi.fn(),
  trackSystemEvent: vi.fn(),
}));

describe(trackGenerationFailedStep, () => {
  it("counts the failure for the learner who started the run, with their goal and client", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "exam", userId: user.id });

    await trackGenerationFailedStep({
      analytics: { distinctId: user.id, goalId: goal.id, platform: "ios" },
      contentKind: "lesson",
      task: "lesson-content",
    });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Generation Failed",
        properties: { content_kind: "lesson", model: null, task: "lesson-content" },
        shared: expect.objectContaining({ goal_kind: "exam", platform: "ios" }),
      }),
    );

    expect(trackSystemEvent).not.toHaveBeenCalled();
  });

  it("counts a run no learner started under the system", async () => {
    await trackGenerationFailedStep({ contentKind: "course", task: "course-remaining-bands" });

    expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
      name: "Generation Failed",
      properties: { content_kind: "course", model: null, task: "course-remaining-bands" },
    });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});
