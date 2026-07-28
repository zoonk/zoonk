import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getCurrentUser } from "@zoonk/core/users/current";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserAnalyticsState } from "./get-current-user-analytics-disabled";

vi.mock("@zoonk/core/auth/subscription", () => ({ getActiveSubscription: vi.fn() }));
vi.mock("@zoonk/core/users/current", () => ({ getCurrentUser: vi.fn() }));

describe(getCurrentUserAnalyticsState, () => {
  beforeEach(() => {
    vi.mocked(getActiveSubscription).mockReset();
    vi.mocked(getCurrentUser).mockReset();
  });

  it("keeps analytics available when the optional subscription lookup fails", async () => {
    vi.mocked(getActiveSubscription).mockRejectedValue(new Error("Subscription unavailable"));

    vi.mocked(getCurrentUser, { partial: true }).mockResolvedValue({
      analyticsDisabled: false,
      id: "user-1",
      username: "learner",
    });

    await expect(getCurrentUserAnalyticsState()).resolves.toStrictEqual({
      analyticsDisabled: false,
      plan: "free",
      userId: "user-1",
      username: "learner",
    });
  });
});
