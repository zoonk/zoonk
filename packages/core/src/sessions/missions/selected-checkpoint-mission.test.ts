import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { toBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";
import { toBlockPick } from "./block-candidates";
import { getDayMissions } from "./get-day-missions";
import { settleMissions } from "./settle-missions";

function selectedCheckpoint(mock: boolean): PlannedBlock {
  return {
    canDo: null,
    estimatedMinutes: 15,
    kind: "checkpoint",
    lessonId: null,
    payload: toBlockPayload({
      checkpoint: {
        kind: mock ? "weekly" : "boss",
        mock,
        passMark: 7,
        phase: mock ? null : 0,
        rematch: false,
        timeLimitMinutes: 15,
      },
      planItemKey: mock ? "mock:2026-09-30" : "boss:0",
    }),
  };
}

describe("mission identity before a selected checkpoint has a saved plan ID", () => {
  it.each([false, true])(
    "does not claim the %s checkpoint's mission for completing its co-event",
    async (mock) => {
      const user = await userFixture();
      const goal = await goalFixture({ kind: "exam", userId: user.id });
      const target = selectedCheckpoint(mock);
      const other = selectedCheckpoint(!mock);
      const pick = toBlockPick({ block: target, kind: mock ? "mock" : "challenge" });

      const session = await studySessionFixture({
        goalId: goal.id,
        missions: { picks: [pick], version: 1 },
        userId: user.id,
      });

      const [targetBlock] = await Promise.all([
        studySessionBlockFixture({ ...target, position: 0, sessionId: session.id }),
        studySessionBlockFixture({
          ...other,
          completedAt: new Date(),
          position: 1,
          sessionId: session.id,
          status: "completed",
        }),
      ]);

      const read = async () =>
        getDayMissions({
          session: await prisma.studySession.findUniqueOrThrow({
            include: STUDY_SESSION_INCLUDE,
            where: { id: session.id },
          }),
          timeZone: "UTC",
        });

      await expect(read()).resolves.toMatchObject([
        {
          done: 0,
          kind: pick.kind,
          opens: { blockId: targetBlock.id, kind: "block" },
          status: "todo",
        },
      ]);

      const revision = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      await expect(
        settleMissions({
          revalidation: "skip",
          sessionId: session.id,
          timeZone: "UTC",
          userId: user.id,
        }),
      ).resolves.toMatchObject({ fullMealPaid: false, newlyDone: [] });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ learnerRevision: revision.learnerRevision });

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).resolves.toMatchObject({ fullMealAt: null });
    },
  );
});
