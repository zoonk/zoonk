import { openedStudyDayResponseSchema } from "@/lib/openapi/schemas/open-study-day";
import { studySessionResponseSchema } from "@/lib/openapi/schemas/study-sessions";
import { todayResponseSchema } from "@/lib/openapi/schemas/today";
import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { mockSession } from "../../../../../../packages/core/src/_test-utils/mock-session";
import {
  SESSION_NOW,
  SESSION_TODAY,
  sessionGoalFixture,
} from "../../../../../../packages/core/src/sessions/_test-utils/session-goal";
import { POST as openDay } from "../goals/[goalId]/study-sessions/route";
import { GET as readSession } from "../study-sessions/[sessionId]/route";
import { GET as readToday } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

describe("day lesson snapshots", () => {
  afterEach(() => vi.useRealTimers());

  it("returns the same snapshot and alternative on Today, session and day opening", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);

    const user = await userFixture();
    const { goal, lessons } = await sessionGoalFixture({ userId: user.id });
    const [lesson] = lessons;

    if (!lesson) {
      throw new Error("Expected a lesson in the fixture");
    }

    const [session] = await Promise.all([
      studySessionFixture({ goalId: goal.id, localDate: SESSION_TODAY, userId: user.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      prisma.lesson.update({
        data: { contentRunId: "wrun_from_row", contentStatus: "running" },
        where: { id: lesson.id },
      }),
    ]);

    await Promise.all([
      studySessionBlockFixture({ lessonId: lesson.id, position: 0, sessionId: session.id }),
      studySessionBlockFixture({ kind: "review", position: 1, sessionId: session.id }),
    ]);

    mockSession(user.id);

    const todayResponse = await readToday(
      new NextRequest(`http://localhost/v1/today?goalId=${goal.id}&timeZone=UTC`),
    );

    const sessionResponse = await readSession(
      new NextRequest(`http://localhost/v1/study-sessions/${session.id}?timeZone=UTC`),
      { params: Promise.resolve({ sessionId: session.id }) },
    );

    const openResponse = await openDay(
      new NextRequest(`http://localhost/v1/goals/${goal.id}/study-sessions`, {
        body: JSON.stringify({ shownDate: "2026-09-30", timeZone: "UTC" }),
        method: "POST",
      }),
      { params: Promise.resolve({ goalId: goal.id }) },
    );

    expect([todayResponse.status, sessionResponse.status, openResponse.status]).toStrictEqual([
      200, 200, 200,
    ]);

    const today = todayResponseSchema.parse(await todayResponse.json());
    const saved = studySessionResponseSchema.parse(await sessionResponse.json());
    const opened = openedStudyDayResponseSchema.parse(await openResponse.json());

    const snapshot = {
      alternativePosition: 1,
      blocks: [
        { lesson: { setAside: false, status: "generating" }, lessonId: lesson.id },
        { lesson: null, lessonId: null },
      ],
    };

    expect(today.session).toMatchObject(snapshot);
    expect(today.lessonStatus).toMatchObject({ [lesson.id]: "generating" });
    expect(saved).toMatchObject(snapshot);
    expect(opened.session.alternativePosition).toBe(snapshot.alternativePosition);
    expect(opened.session.blocks.slice(0, 2)).toMatchObject(snapshot.blocks);

    expect(opened.session.blocks.slice(2)).toMatchObject([
      { lesson: { setAside: false, status: "notStarted" } },
      { lesson: { setAside: false, status: "notStarted" } },
    ]);

    expect(getRun).not.toHaveBeenCalled();
  });
});
