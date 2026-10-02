import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { trackServerEvent } from "../../analytics/server";
import { completeLessonPlanItems, scheduleLessonCanDos } from "../../sessions/_utils/plan-items";
import { trackCallCanDos } from "./can-do-events";

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../../analytics/server", () => ({ trackServerEvent: vi.fn() }));

type Setup = Awaited<ReturnType<typeof languageGoalFixture>>;

/** Checks the lesson off as the lesson player does: analytics is scheduled once it commits. */
async function finishLesson({ lessonId, userId }: { lessonId: string; userId: string }) {
  const goals = await prisma.$transaction((tx) =>
    completeLessonPlanItems(tx, { lessonId, now: new Date(), userId }),
  );

  scheduleLessonCanDos({ goals, lessonId, userId });
}

/** A finished call on the renting unit, won when it met every objective. */
function renting({ renting: unit, user }: Setup, { won }: { won: boolean }) {
  const objectives = RENTING_SCENARIO.objectives.map((objective) => objective.label);

  return prisma.languageConversation.create({
    data: {
      chapterId: unit.id,
      endedAt: new Date(),
      kind: "checkpoint",
      language: "pt",
      level: "A2",
      minutes: 1,
      objectivesMet: won ? objectives : [],
      scenario: RENTING_SCENARIO,
      status: "completed",
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId: user.id,
    },
  });
}

function sentCanDos() {
  return vi
    .mocked(trackServerEvent)
    .mock.calls.flatMap(([event]) => (event.name === "Can-do Reached" ? [event] : []));
}

describe("Can-do Reached", () => {
  it("is sent once when a lesson finishes its unit, not before and not again", async () => {
    const setup = await languageGoalFixture();
    const [first, second] = setup.lessons;
    const flush = runDeferredWork();

    await finishLesson({ lessonId: first?.id ?? "", userId: setup.user.id });
    await flush();
    expect(sentCanDos()).toStrictEqual([]);

    await finishLesson({ lessonId: second?.id ?? "", userId: setup.user.id });
    await finishLesson({ lessonId: second?.id ?? "", userId: setup.user.id });
    await flush();

    expect(sentCanDos()).toStrictEqual([
      expect.objectContaining({
        distinctId: setup.user.id,
        properties: { can_dos: 1, chapter_id: setup.arriving.id },
        shared: expect.objectContaining({ goal_kind: "language" }),
      }),
    ]);
  });

  it("isn't sent for a unit's lessons when a won call already reached its checks", async () => {
    const setup = await languageGoalFixture();
    const flush = runDeferredWork();
    await renting(setup, { won: true });

    for (const lesson of setup.lessons.slice(2)) {
      // oxlint-disable-next-line no-await-in-loop -- The unit finishes with its last lesson.
      await finishLesson({ lessonId: lesson.id, userId: setup.user.id });
    }

    await flush();

    expect(sentCanDos()).toStrictEqual([]);
  });

  it("is sent when a won call reaches the checks first, not for a later win", async () => {
    const setup = await languageGoalFixture();
    const call = { chapterId: setup.renting.id, goalId: setup.goal.id, userId: setup.user.id };

    await renting(setup, { won: false });
    const won = await renting(setup, { won: true });
    await trackCallCanDos({ ...call, conversationId: won.id });

    const wonAgain = await renting(setup, { won: true });
    await trackCallCanDos({ ...call, conversationId: wonAgain.id });

    expect(sentCanDos()).toStrictEqual([
      expect.objectContaining({
        distinctId: setup.user.id,
        properties: { can_dos: 1, chapter_id: setup.renting.id },
      }),
    ]);
  });
});
