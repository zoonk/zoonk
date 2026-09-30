import { isRateLimited } from "@zoonk/auth/rate-limit";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { checkReviewPace } from "./check-review-pace";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

describe(checkReviewPace, () => {
  it("keeps reviews going and only asks for a pause at unusual volume", async () => {
    const user = await userFixture();
    mockSession(user.id);

    vi.mocked(isRateLimited).mockResolvedValue(false);
    await expect(checkReviewPace()).resolves.toStrictEqual({ status: "allowed" });

    vi.mocked(isRateLimited).mockResolvedValue(true);

    await expect(checkReviewPace()).resolves.toStrictEqual({
      retryAfterSeconds: 60,
      status: "slowDown",
    });

    expect(isRateLimited).toHaveBeenCalledWith(
      expect.objectContaining({ key: `user:${user.id}`, rule: "reviews" }),
    );
  });
});
