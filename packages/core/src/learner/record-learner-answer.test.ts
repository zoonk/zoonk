import { prisma } from "@zoonk/db";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { trackServerEvent } from "../analytics/server";
import { type LearnerAnswer, recordLearnerAnswer } from "./record-learner-answer";

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

const TIME_ZONE = "America/Sao_Paulo";

const SNAPSHOT = {
  answer: "Wrong answer",
  correctAnswer: "Right answer",
  misconception: null,
  question: "What is 25% of 40?",
};

async function setup() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  return { item, skill, user };
}

function answer(overrides: Partial<LearnerAnswer> & Pick<LearnerAnswer, "userId">): LearnerAnswer {
  return {
    answer: { selectedIndex: 0 },
    graded: { durationMs: 15_000, isCorrect: true },
    language: "en",
    purpose: "learning",
    timeZone: TIME_ZONE,
    ...overrides,
  };
}

function wrong(overrides: Partial<LearnerAnswer> & Pick<LearnerAnswer, "userId">): LearnerAnswer {
  return answer({
    answer: { selectedIndex: 1 },
    graded: { durationMs: 15_000, isCorrect: false },
    mistake: { questionText: SNAPSHOT.question, snapshot: SNAPSHOT },
    ...overrides,
  });
}

describe(recordLearnerAnswer, () => {
  it("records the attempt on the learner's local day and reviews the skill", async () => {
    const { item, skill, user } = await setup();
    // 22:30 on September 1st in São Paulo is already September 2nd in UTC.
    const answeredAt = new Date("2026-09-02T01:30:00Z");

    const recorded = await recordLearnerAnswer(
      answer({ answeredAt, itemId: item.id, skillId: skill.id, userId: user.id }),
    );

    expect(recorded.attempt).toMatchObject({
      hour: 22,
      isCorrect: true,
      localDate: new Date("2026-09-01T00:00:00Z"),
      weekday: 2,
    });

    expect(recorded.learnerSkill).toMatchObject({ reps: 1, skillId: skill.id, state: "learning" });
    expect(recorded.mistake).toBeNull();
  });

  it("keeps a skill New after a wrong diagnostic answer and never adds it to the notebook", async () => {
    const { item, skill, user } = await setup();

    const recorded = await recordLearnerAnswer(
      wrong({ itemId: item.id, purpose: "diagnostic", skillId: skill.id, userId: user.id }),
    );

    expect(recorded.learnerSkill).toBeNull();
    expect(recorded.mistake).toBeNull();
    await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("reviews a skill after a right diagnostic answer", async () => {
    const { item, skill, user } = await setup();

    const recorded = await recordLearnerAnswer(
      answer({ itemId: item.id, purpose: "diagnostic", skillId: skill.id, userId: user.id }),
    );

    expect(recorded.learnerSkill?.reps).toBe(1);
  });

  it("adds a wrong learning answer to the notebook with its snapshot and cause", async () => {
    const { item, skill, user } = await setup();

    const recorded = await recordLearnerAnswer(
      wrong({ itemId: item.id, skillId: skill.id, userId: user.id }),
    );

    expect(recorded.mistake).toMatchObject({
      attemptId: recorded.attempt.id,
      cause: "gap",
      itemId: item.id,
      skillId: skill.id,
      snapshot: SNAPSHOT,
      status: "open",
    });

    expect(recorded.causeRequest).toBeNull();
    expect(recorded.learnerSkill?.reps).toBe(1);
  });

  it("asks the classifier when the pattern is ambiguous", async () => {
    const { item, skill, user } = await setup();
    const answers = [true, true, false, true, false];

    await learnerSkillFixture({
      difficulty: 5,
      lastReviewedAt: new Date("2026-09-01T12:00:00Z"),
      reps: 5,
      skillId: skill.id,
      stability: 3,
      state: "learning",
      userId: user.id,
    });

    await Promise.all(
      answers.map((isCorrect, index) =>
        attemptFixture({
          answeredAt: new Date(Date.UTC(2026, 8, 1, index)),
          isCorrect,
          skillId: skill.id,
          userId: user.id,
        }),
      ),
    );

    const recorded = await recordLearnerAnswer(
      wrong({ itemId: item.id, skillId: skill.id, userId: user.id }),
    );

    expect(recorded.mistake?.cause).toBeNull();

    expect(recorded.causeRequest).toStrictEqual({
      input: {
        correctAnswer: "Right answer",
        language: "en",
        learnerAnswer: "Wrong answer",
        misconception: "",
        question: SNAPSHOT.question,
        recentAccuracy: "3 of 5 right",
      },
      mistakeId: recorded.mistake?.id,
      userId: user.id,
    });
  });

  it("keeps one open entry per question", async () => {
    const { item, skill, user } = await setup();

    const first = await recordLearnerAnswer(
      wrong({ itemId: item.id, skillId: skill.id, userId: user.id }),
    );

    const second = await recordLearnerAnswer(
      wrong({ itemId: item.id, skillId: skill.id, userId: user.id }),
    );

    expect(second.mistake?.id).toBe(first.mistake?.id);
    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("fixes a mistake answered right on a later day, not on the same day", async () => {
    const { item, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: new Date("2026-09-01T15:00:00Z"),
      itemId: item.id,
      skillId: skill.id,
      userId: user.id,
    });

    const sameDay = await recordLearnerAnswer(
      answer({
        answeredAt: new Date("2026-09-01T20:00:00Z"),
        itemId: item.id,
        skillId: skill.id,
        userId: user.id,
      }),
    );

    const nextDay = await recordLearnerAnswer(
      answer({
        answeredAt: new Date("2026-09-02T15:00:00Z"),
        itemId: item.id,
        skillId: skill.id,
        userId: user.id,
      }),
    );

    expect(sameDay.fixedMistakeIds).toStrictEqual([]);
    expect(nextDay.fixedMistakeIds).toStrictEqual([mistake.id]);

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ fixedAt: new Date("2026-09-02T15:00:00Z"), status: "fixed" });
  });

  it("reports a spaced review, a skill changing state and a fixed mistake after the response", async () => {
    const { item, skill, user } = await setup();

    await mistakeFixture({
      cause: "gap",
      createdAt: new Date("2026-09-01T15:00:00Z"),
      itemId: item.id,
      skillId: skill.id,
      userId: user.id,
    });

    const flush = runDeferredWork();
    const onSkill = { itemId: item.id, skillId: skill.id, userId: user.id };

    await recordLearnerAnswer(answer({ ...onSkill, answeredAt: new Date("2026-09-01T16:00:00Z") }));
    await recordLearnerAnswer(answer({ ...onSkill, answeredAt: new Date("2026-09-01T20:00:00Z") }));
    await recordLearnerAnswer(answer({ ...onSkill, answeredAt: new Date("2026-09-03T15:00:00Z") }));
    await flush();

    const sent = vi.mocked(trackServerEvent).mock.calls.map(([event]) => event);

    // The same-day repeat is neither a review nor a change; the spaced one makes the skill Solid.
    expect(sent).toStrictEqual([
      expect.objectContaining({
        distinctId: user.id,
        name: "Skill Level Changed",
        properties: { from_state: "new", skill_id: skill.id, to_state: "learning" },
      }),
      expect.objectContaining({
        name: "Review Completed",
        properties: expect.objectContaining({
          days_since_last_review: 2,
          is_correct: true,
          skill_id: skill.id,
        }),
      }),
      expect.objectContaining({
        name: "Skill Level Changed",
        properties: { from_state: "learning", skill_id: skill.id, to_state: "solid" },
      }),
      expect.objectContaining({
        name: "Mistake Fixed",
        properties: { cause: "gap", skill_id: skill.id },
      }),
    ]);
  });

  it("applies answers given at the same time one after the other", async () => {
    const { item, skill, user } = await setup();

    await Promise.all(
      Array.from({ length: 3 }, () =>
        recordLearnerAnswer(answer({ itemId: item.id, skillId: skill.id, userId: user.id })),
      ),
    );

    await expect(
      prisma.learnerSkill.findUniqueOrThrow({
        where: { userSkill: { skillId: skill.id, userId: user.id } },
      }),
    ).resolves.toMatchObject({ reps: 3 });
  });

  it("moves answers on a merged skill to the skill it was merged into", async () => {
    const [user, survivor] = await Promise.all([userFixture(), skillFixture()]);
    const merged = await skillFixture({ mergedIntoId: survivor.id });

    const recorded = await recordLearnerAnswer(answer({ skillId: merged.id, userId: user.id }));

    expect(recorded.attempt.skillId).toBe(survivor.id);
    expect(recorded.learnerSkill?.skillId).toBe(survivor.id);
  });
});
