import { sendEmail } from "@zoonk/mailer";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { analytics } from "../_test-utils/test-boundaries";
import { submitFeedback } from "../feedback/submit-feedback";
import { deleteMemoryFact } from "../memory/delete-memory-fact";
import { updateMemoryFact } from "../memory/update-memory-fact";
import { updateMemorySettings } from "../memory/update-memory-settings";
import { awardMilestones } from "../milestones/award-milestones";
import { answerStudyQuestion } from "../sessions/answer-study-question";
import { toBlockPayload } from "../sessions/block-payload";
import { settleMissions } from "../sessions/missions/settle-missions";
import { answerOnboardingQuestion } from "../view-models/onboarding/answer-onboarding-question";

async function learner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

describe("write outcome analytics", () => {
  beforeEach(() => {
    analytics.trackServerEvent.mockClear();
    vi.mocked(sendEmail).mockResolvedValue({ data: Response.json({ ok: true }), error: null });
  });

  it("sends feedback and content report properties after storage", async () => {
    const user = await learner();
    const flush = runDeferredWork();
    const contentId = crypto.randomUUID();

    await submitFeedback({
      context: { contentId, contentKind: "lesson" },
      email: "learner@zoonk.test",
      message: "Wrong answer",
    });

    await flush();

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Feedback Sent",
        properties: { content_kind: "lesson" },
      }),
    );

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Content Reported",
        properties: { content_id: contentId, content_kind: "lesson", reason: "problem" },
      }),
    );
  });

  it("keeps signed-out feedback as an anonymous system event", async () => {
    mockSession(null);
    const flush = runDeferredWork();
    await submitFeedback({ email: "visitor@zoonk.test", message: "Question about Zoonk" });
    await flush();

    expect(analytics.trackSystemEvent).toHaveBeenCalledWith({
      name: "Feedback Sent",
      properties: { content_kind: null },
    });
  });

  it("sends Buddy Chosen from the onboarding answer", async () => {
    const user = await learner();
    const flush = runDeferredWork();
    const input = { buddy: { kind: "zu", name: "Pip" } } as const;
    const goal = await goalFixture({ userId: user.id });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { buddy: input.buddy, question: "buddy" },
    });

    await flush();

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Buddy Chosen",
        properties: { buddy: "zu", renamed: true },
      }),
    );
  });

  it("sends Memory Turned Off once for the transition", async () => {
    const user = await learner();
    const flush = runDeferredWork();
    await updateMemorySettings({ enabled: false });
    await updateMemorySettings({ enabled: false });
    await flush();

    expect(analytics.trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ distinctId: user.id, name: "Memory Turned Off" }),
    );
  });

  it("sends the original category and origin for manual memory corrections and removal", async () => {
    const user = await learner();
    const flush = runDeferredWork();

    const fact = await memoryFactFixture({
      category: "routine",
      origin: "noticed",
      userId: user.id,
    });

    await updateMemoryFact({ factId: fact.id, input: { category: "preferences" } });
    await deleteMemoryFact(fact.id);
    await flush();

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Memory Updated",
        properties: { category: "routine", change: "updated", origin: "noticed" },
      }),
    );

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Memory Updated",
        properties: { category: "preferences", change: "deleted", origin: "said" },
      }),
    );
  });

  it("sends legacy names for newly completed missions once", async () => {
    const user = await learner();
    const flush = runDeferredWork();

    const session = await studySessionFixture({
      missions: {
        picks: [
          { anchor: { blockKind: "learn" }, kind: "somethingNew", total: 1 },
          { anchor: {}, kind: "fixMistake", total: 1 },
        ],
        version: 1,
      },
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "learn",
      sessionId: session.id,
      status: "completed",
    });

    await mistakeFixture({ fixedAt: new Date(), status: "fixed", userId: user.id });
    const input = { blockId: block.id, sessionId: session.id, timeZone: "UTC", userId: user.id };
    await settleMissions(input);
    await settleMissions(input);
    await flush();

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Mission Completed",
        properties: { full_meal: true, mission: "new" },
      }),
    );

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Mission Completed",
        properties: { full_meal: true, mission: "fix" },
      }),
    );
  });

  it("sends each Hyperdrive increase when its answer is saved", async () => {
    const user = await learner();
    const flush = runDeferredWork();
    const skill = await skillFixture();

    const items = await Promise.all(
      [1, 2, 3].map(() => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
    );

    const session = await studySessionFixture({ status: "active", userId: user.id });

    const block = await studySessionBlockFixture({
      payload: toBlockPayload({ itemIds: items.map((item) => item.id) }),
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    });

    const answer = (itemId: string) =>
      answerStudyQuestion({
        blockId: block.id,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId },
        sessionId: session.id,
      });

    await answer(items[0]?.id ?? "");
    await answer(items[1]?.id ?? "");
    await answer(items[2]?.id ?? "");
    await flush();

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Hyperdrive Reached", properties: { multiplier: 2 } }),
    );

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Hyperdrive Reached", properties: { multiplier: 3 } }),
    );
  });

  it("sends newly earned milestones once with legacy kind names", async () => {
    const user = await learner();
    const flush = runDeferredWork();

    const award = {
      badges: [{ key: "analytics-test", kind: "buddyStage" as const }],
      brainPower: null,
      userId: user.id,
    };

    await awardMilestones(award);
    await awardMilestones(award);
    await flush();

    expect(analytics.trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Milestone Earned",
        properties: { key: "analytics-test", milestone: "buddy_stage" },
      }),
    );
  });
});
