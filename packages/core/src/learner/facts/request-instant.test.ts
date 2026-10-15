import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadTodayLearnBlocks } from "../../view-models/_utils/today-lesson-order";
import { getCurrentUserReviewSchedule } from "../get-current-user-review-schedule";
import * as requestClock from "./request-instant";
import type * as ProgressDateContext from "../../progress/get-request-date-context";

const INSTANT = new Date("2026-07-12T12:00:00Z");

describe("GET request instant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("uses the same fact for progress and each goal's own local day without writing", async () => {
    const user = await userFixture();

    const [east, west] = await Promise.all([
      goalFixture({ timezone: "Pacific/Kiritimati", userId: user.id }),
      goalFixture({ timezone: "Pacific/Honolulu", userId: user.id }),
    ]);

    await learningProfileFixture({ activeGoalId: west.id, userId: user.id });
    mockSession(user.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(INSTANT);

    /** Exercise the real capability rather than the shared progress tests' date boundary. */
    const { getRequestProgressDateContext } = await vi.importActual<typeof ProgressDateContext>(
      "../../progress/get-request-date-context",
    );

    const reads = await countDatabaseStatements(() =>
      Promise.all([
        getCurrentUserReviewSchedule({ goalId: east.id, timeZone: "UTC" }),
        getCurrentUserReviewSchedule({ goalId: west.id, timeZone: "UTC" }),
        getRequestProgressDateContext(),
      ]),
    );

    expect(reads.writes).toBe(0);
    const [eastSchedule, westSchedule, progress] = reads.result;

    expect(
      eastSchedule.status === "ready" ? eastSchedule.schedule.forecast[0] : null,
    ).toStrictEqual({ localDate: new Date("2026-07-13T00:00:00Z"), reviews: 0 });

    expect(
      westSchedule.status === "ready" ? westSchedule.schedule.forecast[0] : null,
    ).toStrictEqual({ localDate: new Date("2026-07-12T00:00:00Z"), reviews: 0 });

    expect(progress).toStrictEqual({
      currentDate: new Date("2026-07-12T00:00:00Z"),
      currentInstant: INSTANT,
      timeZone: "Pacific/Honolulu",
    });
  });

  it("reads a visitor's UTC context at that instant without accessing learner rows", async () => {
    mockSession(null);
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(INSTANT);

    const { getRequestProgressDateContext } = await vi.importActual<typeof ProgressDateContext>(
      "../../progress/get-request-date-context",
    );

    const reads = await countDatabaseStatements(getRequestProgressDateContext);

    expect(reads).toStrictEqual({
      result: {
        currentDate: new Date("2026-07-12T00:00:00Z"),
        currentInstant: INSTANT,
        timeZone: "UTC",
      },
      statements: 0,
      writes: 0,
    });
  });

  it("uses that goal-local day for stored Today priority without building or writing", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "Pacific/Kiritimati", userId: user.id });

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: new Date("2026-07-13T00:00:00Z"),
      userId: user.id,
    });

    await Promise.all([
      studySessionBlockFixture({
        payload: { planItemId: "pending-item" },
        position: 0,
        sessionId: session.id,
        status: "pending",
      }),
      studySessionBlockFixture({
        payload: { planItemId: "active-item" },
        position: 1,
        sessionId: session.id,
        status: "active",
      }),
    ]);

    mockSession(user.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(INSTANT);

    const reads = await countDatabaseStatements(() => loadTodayLearnBlocks(goal));

    expect(reads.writes).toBe(0);

    expect(reads.result).toStrictEqual([
      { lessonId: null, planItemId: "active-item" },
      { lessonId: null, planItemId: "pending-item" },
    ]);
  });
});
