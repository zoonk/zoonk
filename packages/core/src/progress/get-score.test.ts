import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScore } from "./get-score";

function mockScoreDate(now: Date = new Date(), timeZone = "UTC") {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: now,
    currentInstant: now,
    timeZone,
  });
}

describe("unauthenticated users", () => {
  it("returns null", async () => {
    mockSession(null);
    mockScoreDate();

    const result = await getScore();

    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("propagates identity-provider failures", async () => {
    const error = new Error("Session lookup failed");
    mockSessionFailure(error);
    mockScoreDate();

    await expect(getScore()).rejects.toBe(error);
  });

  it("returns null when user has no DailyProgress records", async () => {
    const user = await userFixture();
    mockSession(user.id);
    mockScoreDate();

    const result = await getScore();

    expect(result).toBeNull();
  });
});
