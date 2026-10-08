import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUnderageAccount } from "./delete-underage-account";

// PostHog is an external service; the mock records what would leave the server.
const posthogClient = vi.hoisted(() => ({ captureImmediate: vi.fn(), shutdown: vi.fn() }));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn(
    class {
      captureImmediate = posthogClient.captureImmediate;
      shutdown = posthogClient.shutdown;
    },
  ),
}));

describe(deleteUnderageAccount, () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "project-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deletes the account and tells PostHog, so its analytics can be deleted too", async () => {
    const learner = await userFixture();

    await deleteUnderageAccount(learner.id);

    await expect(prisma.user.findUnique({ where: { id: learner.id } })).resolves.toBeNull();

    expect(posthogClient.captureImmediate).toHaveBeenCalledExactlyOnceWith({
      distinctId: learner.id,
      event: "Account Deleted",
      properties: {},
    });
  });

  it("tells PostHog nothing about an account kept out of analytics", async () => {
    const learner = await userFixture();

    await prisma.user.update({ data: { analyticsDisabled: true }, where: { id: learner.id } });
    await deleteUnderageAccount(learner.id);

    await expect(prisma.user.findUnique({ where: { id: learner.id } })).resolves.toBeNull();
    expect(posthogClient.captureImmediate).not.toHaveBeenCalled();
  });
});
