import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { getStudySession } from "../get-study-session";
import { getDayMissions } from "./get-day-missions";

/** Next has no request context in Vitest; authenticate through the real test auth and database. */
vi.unmock("../../users/get-session");
vi.mock("@zoonk/auth", () => import("../../../../auth/src/testing"));

describe("lesson minutes across saved missions and session display", () => {
  it.each(["somethingNew", "finishChapter"] as const)(
    "refreshes a %s mission after lesson writing without rewriting the planned budget",
    async (kind) => {
      const [user, lesson] = await Promise.all([
        userFixture(),
        libraryLessonFixture({ estimatedMinutes: 3 }),
      ]);

      const goal = await goalFixture({ userId: user.id });

      const day = await studySessionFixture({
        goalId: goal.id,
        missions: { picks: [{ anchor: { lessonIds: [lesson.id] }, kind, total: 1 }], version: 1 },
        plannedMinutes: 3,
        userId: user.id,
      });

      const block = await studySessionBlockFixture({
        estimatedMinutes: 3,
        lessonId: lesson.id,
        sessionId: day.id,
      });

      const signedIn = await auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        returnHeaders: true,
      });

      const cookie = signedIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");

      vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));

      const initial = await getStudySession({ input: { timeZone: "UTC" }, sessionId: day.id });

      expect(initial).toMatchObject({
        session: { blocks: [{ estimatedMinutes: 3 }], missions: [{ minutes: 3 }] },
        status: "ready",
      });

      await prisma.lesson.update({ data: { estimatedMinutes: 8 }, where: { id: lesson.id } });

      const refreshed = await getStudySession({ input: { timeZone: "UTC" }, sessionId: day.id });

      expect(refreshed).toMatchObject({
        session: {
          blocks: [{ estimatedMinutes: 8, id: block.id }],
          minutes: { done: 0, planned: 3 },
          missions: [{ minutes: 8 }],
        },
        status: "ready",
      });

      const stored = await prisma.studySession.findUniqueOrThrow({
        include: STUDY_SESSION_INCLUDE,
        where: { id: day.id },
      });

      expect(stored.plannedMinutes).toBe(3);
      expect(stored.blocks[0]?.estimatedMinutes).toBe(3);

      await expect(getDayMissions({ session: stored, timeZone: "UTC" })).resolves.toMatchObject([
        { minutes: 8 },
      ]);

      await prisma.studySessionBlock.update({
        data: { status: "completed" },
        where: { id: block.id },
      });

      const finished = await getStudySession({ input: { timeZone: "UTC" }, sessionId: day.id });

      expect(finished).toMatchObject({
        session: {
          blocks: [{ estimatedMinutes: 8 }],
          minutes: { done: 3, planned: 3 },
          missions: [{ done: 1, status: "done" }],
        },
        status: "ready",
      });

      if (finished.status !== "ready") {
        throw new Error(`Expected a session, got ${finished.status}`);
      }

      expect(finished.session.missions[0]).not.toHaveProperty("minutes");
    },
  );
});
