import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { getReviewHorizon, loadReviewCapsules } from "./_utils/load-review-capsules";
import { answerStudyQuestion } from "./answer-study-question";
import { readBlockPayload, toBlockPayload } from "./block-payload";
import { getStudyBlock } from "./get-study-block";
import { startStudyBlock } from "./start-study-block";

const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = new Date("2020-09-28");

async function setup() {
  freezeClock();
  vi.setSystemTime(NOW);

  const [user, shared, remaining] = await Promise.all([
    userFixture(),
    skillFixture(),
    skillFixture(),
  ]);

  const goals = await Promise.all([
    goalFixture({ timezone: "UTC", userId: user.id }),
    goalFixture({ timezone: "UTC", userId: user.id }),
  ]);

  await Promise.all(goals.map((goal) => planFixture({ goalId: goal.id })));

  const [source, other] = await Promise.all(
    goals.map((goal) =>
      studySessionFixture({ goalId: goal.id, startedAt: NOW, status: "active", userId: user.id }),
    ),
  );

  if (!source || !other) {
    throw new Error("Missing sessions");
  }

  const items = await Promise.all(
    [shared, shared, remaining].map((skill) =>
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    ),
  );

  const [first, second, third] = items;

  if (!first || !second || !third) {
    throw new Error("Missing questions");
  }

  await Promise.all(
    [shared, remaining].map((skill) =>
      learnerSkillFixture({
        difficulty: 5,
        due: TODAY,
        lastReviewedAt: new Date("2020-09-27T12:00:00Z"),
        reps: 2,
        skillId: skill.id,
        stability: 1,
        state: "learning",
        userId: user.id,
      }),
    ),
  );

  const capsule = {
    format: "rapidFire" as const,
    itemIds: [first.id, second.id],
    key: `skill:${shared.id}`,
    lessonId: null,
    skillIds: [shared.id],
    title: "Shared topic",
  };

  const [sourceBlock, otherBlock] = await Promise.all([
    studySessionBlockFixture({
      kind: "review",
      payload: toBlockPayload({ capsules: [capsule], skillIds: [shared.id] }),
      sessionId: source.id,
      startedAt: NOW,
      status: "active",
    }),
    studySessionBlockFixture({
      kind: "review",
      payload: toBlockPayload({
        capsules: [
          {
            ...capsule,
            itemIds: items.map((item) => item.id),
            skillIds: [shared.id, remaining.id],
          },
        ],
        skillIds: [shared.id, remaining.id],
      }),
      sessionId: other.id,
    }),
  ]);

  mockSession(user.id);

  return {
    first,
    items,
    other,
    otherBlock,
    remaining,
    second,
    shared,
    source,
    sourceBlock,
    third,
    user,
  };
}

async function answerShared(fixture: Awaited<ReturnType<typeof setup>>, correct: boolean) {
  await expect(
    answerStudyQuestion({
      blockId: fixture.sourceBlock.id,
      input: {
        answer: { selectedIndex: correct ? 0 : 1 },
        durationMs: 6000,
        itemId: fixture.first.id,
        timeZone: "UTC",
      },
      sessionId: fixture.source.id,
    }),
  ).resolves.toMatchObject({ feedback: { isCorrect: correct }, status: "ready" });
}

describe("shared daily skill reviews", () => {
  it.each([true, false])(
    "serves only unreviewed skills in another saved goal after a correct=%s answer",
    async (correct) => {
      const fixture = await setup();
      await answerShared(fixture, correct);

      const memory = await prisma.learnerSkill.findUniqueOrThrow({
        where: { userSkill: { skillId: fixture.shared.id, userId: fixture.user.id } },
      });

      expect(memory.lastReviewedAt).toStrictEqual(NOW);
      expect(memory.due?.getTime()).toBeGreaterThan(TODAY.getTime());

      const detail = await getStudyBlock({
        blockId: fixture.otherBlock.id,
        sessionId: fixture.other.id,
      });

      expect(
        detail.status === "ready" && detail.detail.questions.map((question) => question.itemId),
      ).toStrictEqual([fixture.third.id]);

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: fixture.otherBlock.id } }),
      ).resolves.toStrictEqual(fixture.otherBlock);

      await expect(
        startStudyBlock({ blockId: fixture.otherBlock.id, input: {}, sessionId: fixture.other.id }),
      ).resolves.toMatchObject({ status: "ready" });

      const saved = await prisma.studySessionBlock.findUniqueOrThrow({
        where: { id: fixture.otherBlock.id },
      });

      expect(readBlockPayload(saved).capsules).toMatchObject([
        { itemIds: [fixture.third.id], skillIds: [fixture.remaining.id] },
      ]);

      const source = await getStudyBlock({
        blockId: fixture.sourceBlock.id,
        sessionId: fixture.source.id,
      });

      expect(
        source.status === "ready" && source.detail.questions.map((question) => question.itemId),
      ).toContain(fixture.second.id);
    },
  );

  it("skips a fully reviewed block once and owes settlement without adding rewards", async () => {
    const fixture = await setup();

    await prisma.studySessionBlock.update({
      data: {
        payload: toBlockPayload({
          capsules: [
            {
              format: "rapidFire",
              itemIds: [fixture.first.id],
              key: `skill:${fixture.shared.id}`,
              lessonId: null,
              skillIds: [fixture.shared.id],
              title: "Shared topic",
            },
          ],
          skillIds: [fixture.shared.id],
        }),
      },
      where: { id: fixture.otherBlock.id },
    });

    await answerShared(fixture, false);

    const start = () =>
      startStudyBlock({ blockId: fixture.otherBlock.id, input: {}, sessionId: fixture.other.id });

    await expect(Promise.all([start(), start()])).resolves.toStrictEqual([
      { status: "blockFinished" },
      { status: "blockFinished" },
    ]);

    await expect(start()).resolves.toStrictEqual({ status: "blockFinished" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: fixture.otherBlock.id } }),
    ).resolves.toMatchObject({
      brainPower: 0,
      completedAt: null,
      startedAt: null,
      status: "skipped",
    });

    await expect(
      prisma.followUp.count({ where: { kind: "settleSessionDay", userId: fixture.user.id } }),
    ).resolves.toBe(1);
  });

  it("does not select a due-today skill already reviewed today, even if its due date stayed today", async () => {
    const fixture = await setup();
    await answerShared(fixture, false);

    await prisma.learnerSkill.update({
      data: { due: TODAY },
      where: { userSkill: { skillId: fixture.shared.id, userId: fixture.user.id } },
    });

    await expect(
      loadReviewCapsules({
        dailyMinutes: 20,
        examBlueprintId: null,
        field: null,
        horizon: getReviewHorizon({
          finalStretchStart: null,
          goal: { kind: "learn", targetDate: null },
          localDate: TODAY,
          timeZone: "UTC",
        }),
        netScoring: false,
        planLessons: [],
        skillIds: [fixture.shared.id],
        userId: fixture.user.id,
      }),
    ).resolves.toStrictEqual([]);
  });

  it("persists the filtered payload when resuming an already active review", async () => {
    const fixture = await setup();
    const ref = { blockId: fixture.otherBlock.id, sessionId: fixture.other.id };
    await startStudyBlock({ ...ref, input: {} });
    await answerShared(fixture, true);

    await expect(startStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
      status: "ready",
    });

    const saved = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: fixture.otherBlock.id },
    });

    expect(readBlockPayload(saved).capsules).toMatchObject([{ itemIds: [fixture.third.id] }]);
  });

  it("keeps distinct exam practice and mistake drills after the skill's review elsewhere", async () => {
    const fixture = await setup();
    await answerShared(fixture, false);
    const mistake = await prisma.mistake.findFirstOrThrow({ where: { userId: fixture.user.id } });

    const practice = await studySessionBlockFixture({
      kind: "practice",
      payload: toBlockPayload({ itemIds: [fixture.first.id], skillIds: [fixture.shared.id] }),
      position: 1,
      sessionId: fixture.other.id,
    });

    await prisma.studySessionBlock.update({
      data: {
        payload: toBlockPayload({
          drills: [
            {
              itemIds: [fixture.second.id],
              kind: "retry",
              lessonId: null,
              mistakeId: mistake.id,
              timeLimitSeconds: null,
            },
          ],
        }),
      },
      where: { id: fixture.otherBlock.id },
    });

    for (const block of [practice, fixture.otherBlock]) {
      // oxlint-disable-next-line no-await-in-loop -- each separate kind of practice must remain startable
      await expect(
        startStudyBlock({ blockId: block.id, input: {}, sessionId: fixture.other.id }),
      ).resolves.toMatchObject({ status: "ready" });
      // oxlint-disable-next-line no-await-in-loop -- inspect each goal-specific activity after starting it
      const detail = await getStudyBlock({ blockId: block.id, sessionId: fixture.other.id });
      expect(detail.status === "ready" && detail.detail.questions).toHaveLength(1);
    }
  });

  it("uses the target goal's local midnight and allows the skill again on its next local day", async () => {
    const fixture = await setup();

    await prisma.goal.update({
      data: { timezone: "America/Sao_Paulo" },
      where: { id: fixture.other.goalId ?? "" },
    });

    await answerShared(fixture, false);
    vi.setSystemTime(new Date("2020-09-29T02:30:00Z"));

    const sameDay = await getStudyBlock({
      blockId: fixture.otherBlock.id,
      sessionId: fixture.other.id,
    });

    expect(
      sameDay.status === "ready" && sameDay.detail.questions.map((question) => question.itemId),
    ).toStrictEqual([fixture.third.id]);

    vi.setSystemTime(new Date("2020-09-29T03:00:00Z"));

    const nextDay = await getStudyBlock({
      blockId: fixture.otherBlock.id,
      sessionId: fixture.other.id,
    });

    expect(
      nextDay.status === "ready" && nextDay.detail.questions.map((question) => question.itemId),
    ).toStrictEqual(fixture.items.map((item) => item.id));
  });

  it("retains answers already saved in an active goal when another goal reviews that skill", async () => {
    const fixture = await setup();

    await startStudyBlock({
      blockId: fixture.otherBlock.id,
      input: {},
      sessionId: fixture.other.id,
    });

    await answerStudyQuestion({
      blockId: fixture.otherBlock.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 6000, itemId: fixture.first.id },
      sessionId: fixture.other.id,
    });

    await answerShared(fixture, true);

    const detail = await getStudyBlock({
      blockId: fixture.otherBlock.id,
      sessionId: fixture.other.id,
    });

    expect(
      detail.status === "ready" && detail.detail.questions.map((question) => question.itemId),
    ).toStrictEqual([fixture.first.id, fixture.third.id]);

    expect(detail.status === "ready" && detail.detail.questions[0]?.answered).toMatchObject({
      isCorrect: true,
    });
  });
});
