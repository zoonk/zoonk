import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getStudiedToday } from "./get-studied-today";

const CURRENT_DATE = new Date("2026-07-12T00:00:00Z");
const YESTERDAY = new Date("2026-07-11T00:00:00Z");
const STUDY_SECONDS = 300;

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("./get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

function mockCurrentDate() {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: CURRENT_DATE,
    currentInstant: CURRENT_DATE,
    timeZone: "UTC",
  });
}

describe(getStudiedToday, () => {
  it("is false without a session", async () => {
    mockSession(null);
    mockCurrentDate();

    await expect(getStudiedToday()).resolves.toBe(false);
  });

  it("is true only once the learner studied on their current day", async () => {
    const [studied, yesterdayOnly] = await Promise.all([userFixture(), userFixture()]);
    mockCurrentDate();

    await dailyProgressFixtureMany([
      { date: CURRENT_DATE, timeSpentSeconds: STUDY_SECONDS, userId: studied.id },
      { date: YESTERDAY, timeSpentSeconds: STUDY_SECONDS, userId: yesterdayOnly.id },
    ]);

    mockSession(studied.id);
    await expect(getStudiedToday()).resolves.toBe(true);

    mockSession(yesterdayOnly.id);
    await expect(getStudiedToday()).resolves.toBe(false);
  });
});
