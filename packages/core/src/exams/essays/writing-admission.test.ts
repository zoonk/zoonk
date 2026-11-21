import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import {
  ESSAY_GRADE_COST_MICROS,
  GUEST_DAILY_SPEND_BUDGET_MICROS,
} from "../../entitlements/limits";
import { findCarriedOverSession } from "../../sessions/_utils/current-session";
import { claimEssayGrades } from "./_utils/essay-grade-claims";
import { getWritingAttemptId } from "./_utils/writing-attempt-id";
import { getEssay } from "./get-essay";
import { toProduceBlock } from "./produce-block";
import { saveWritingDraft } from "./save-writing-draft";
import { startWriting } from "./start-writing";
import { admitWriting } from "./writing-admission";
import { findWritingPrompts } from "./writing-supply";

const TASK = {
  minutes: 105,
  taskKey: "notice-1",
  title: "Explain the evidence",
  unit: "answer" as const,
};

const LOCAL_DATE = new Date("2026-11-20");
const CRITERION = { id: "evidence", name: "Evidence", points: null };

async function setup(localDate = LOCAL_DATE) {
  const [blueprint, user, skill] = await Promise.all([
    examBlueprintFixture({
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [
            {
              day: null,
              kind: "written",
              minutes: TASK.minutes,
              name: "Written test",
              questions: 1,
              tasks: [{ count: 1, description: TASK.title, key: TASK.taskKey, lines: 30 }],
            },
          ],
          timeLimitMinutes: TASK.minutes,
          totalQuestions: 1,
        },
        rules: [],
        subjects: [],
      },
    }),
    userFixture(),
    skillFixture(),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const [item, session] = await Promise.all([
    itemFixture({
      content: {
        context: null,
        keyPoints: ["Connect the evidence to the conclusion"],
        question: "Explain the evidence and its implications.",
        rubric: [
          {
            criterion: "Evidence",
            description: "Explain why the evidence supports the conclusion",
            points: null,
          },
        ],
        sampleOutline: "Evidence and conclusion",
        writing: {
          aspects: [
            { criterionId: CRITERION.id, description: "One valid inference", points: null },
          ],
          assessedSkillIds: [skill.id],
          charactersPerLine: 65,
          criteria: [CRITERION],
          grading: { criteria: [], kind: "levels", language: null, rounding: null, zeroing: [] },
          keySource: "practiceKey",
          lines: 30,
          minimumWords: 30,
          points: null,
          taskKey: TASK.taskKey,
          title: TASK.title,
          unit: TASK.unit,
        },
      },
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skill.id,
    }),
    studySessionFixture({ goalId: goal.id, localDate, userId: user.id }),
  ]);

  const block = await studySessionBlockFixture({ ...toProduceBlock(TASK), sessionId: session.id });
  return { block, goal, item, session, user };
}

describe("writing receipts and drafts", () => {
  it("reserves a guest grade at admission and resumes for free after the budget fills", async () => {
    const day = new Date("2040-11-24");
    const { block, user } = await setup(day);
    mockSession(user.id);
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

    await prisma.guestSpendDay.create({
      data: { day, spentMicros: GUEST_DAILY_SPEND_BUDGET_MICROS },
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day);

    try {
      await expect(startWriting({ blockId: block.id })).resolves.toStrictEqual({
        status: "signUpRequired",
      });

      await prisma.guestSpendDay.update({
        data: { spentMicros: GUEST_DAILY_SPEND_BUDGET_MICROS - ESSAY_GRADE_COST_MICROS },
        where: { day },
      });

      const first = await startWriting({ blockId: block.id });
      expect(first).toMatchObject({ status: "ready" });
      await expect(startWriting({ blockId: block.id })).resolves.toStrictEqual(first);

      await expect(prisma.guestSpendDay.findUnique({ where: { day } })).resolves.toMatchObject({
        spentMicros: GUEST_DAILY_SPEND_BUDGET_MICROS,
      });
    } finally {
      vi.useRealTimers();
      await prisma.guestSpendDay.delete({ where: { day } });
    }
  });

  it("issues one receipt to two starts, hides the key, saves one draft revision, and resumes the same block", async () => {
    const { block, goal, item, session, user } = await setup();
    mockSession(user.id);
    await expect(getEssay({ blockId: block.id })).resolves.toStrictEqual({ status: "notFound" });

    const [first, second] = await Promise.all([
      startWriting({ blockId: block.id }),
      startWriting({ blockId: block.id }),
    ]);

    expect(first).toStrictEqual(second);

    if (first.status !== "ready") {
      throw new Error(first.status);
    }

    await expect(
      prisma.writingAdmission.findMany({ where: { userId: user.id } }),
    ).resolves.toMatchObject([{ extra: false, id: first.admissionId, itemIds: [item.id] }]);

    const visibility = await getEssay({ blockId: block.id });

    expect(visibility).toMatchObject({
      essay: { writing: { title: TASK.title } },
      status: "ready",
    });

    expect(visibility.status === "ready" && visibility.essay.writing).not.toHaveProperty("aspects");

    const request = { count: 1, taskKey: TASK.taskKey, unit: TASK.unit };

    await expect(
      findWritingPrompts({ goalId: goal.id, requests: [request], tx: prisma, userId: user.id }),
    ).resolves.toStrictEqual({ requests: [request], status: "missing" });

    const drafts = await Promise.all(
      ["First", "Second"].map((text) =>
        saveWritingDraft({
          blockId: block.id,
          input: { admissionId: first.admissionId, revision: 0, text },
        }),
      ),
    );

    expect(drafts.map(({ status }) => status).toSorted()).toStrictEqual(["conflict", "ready"]);

    const values = drafts.flatMap((result) =>
      "draft" in result && result.draft ? [result.draft] : [],
    );

    expect(values).toHaveLength(2);
    expect(values[0]).toStrictEqual(values[1]);

    const resumed = await findCarriedOverSession({
      goalId: goal.id,
      now: new Date("2026-11-23T14:00:00Z"),
      timeZone: "UTC",
      userId: user.id,
    });

    expect(resumed?.id).toBe(session.id);

    await expect(getEssay({ blockId: block.id })).resolves.toMatchObject({
      essay: { draft: values[0] },
    });
  });

  it("uses one extra receipt for a rewrite and refuses a previous version after a newer draft", async () => {
    const { block, item, session, user } = await setup();
    mockSession(user.id);
    const initial = await startWriting({ blockId: block.id });

    if (initial.status !== "ready") {
      throw new Error(initial.status);
    }

    async function record(admissionId: string, version: "firstDraft" | "rewrite") {
      return prisma.attempt.create({
        data: {
          answer: {
            conditions: { admissionId, estimatedLines: 3, origin: "block", timed: false, version },
            grade: {
              criteria: [],
              errors: [],
              ignoredFrom: null,
              kind: "levels",
              nextStep: null,
              progress: null,
            },
            text: "My first attempt",
          },
          durationMs: 5000,
          hour: 12,
          id: getWritingAttemptId({ admissionId, itemId: item.id }),
          isCorrect: true,
          itemId: item.id,
          localDate: LOCAL_DATE,
          studySessionId: session.id,
          userId: user.id,
          weekday: LOCAL_DATE.getUTCDay(),
        },
      });
    }

    const version = await record(initial.admissionId, "firstDraft");
    const rewrite = () => startWriting({ blockId: block.id, previousAttemptId: version.id });
    const [first, second] = await Promise.all([rewrite(), rewrite()]);
    expect(first).toStrictEqual(second);

    if (first.status !== "ready") {
      throw new Error(first.status);
    }

    expect(first.admissionId).not.toBe(initial.admissionId);
    const rewritten = await record(first.admissionId, "rewrite");

    await expect(
      startWriting({ blockId: block.id, previousAttemptId: rewritten.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(rewrite()).resolves.toStrictEqual({ status: "invalidRewrite" });

    await expect(
      prisma.writingAdmission.count({ where: { extra: true, userId: user.id } }),
    ).resolves.toBe(2);
  });

  it("serializes the last extra allowance and always admits a scheduled start", async () => {
    const { goal, item, session, user } = await setup();

    const blocks = await Promise.all(
      [1, 2, 3].map((position) =>
        studySessionBlockFixture({ ...toProduceBlock(TASK), position, sessionId: session.id }),
      ),
    );

    await prisma.writingAdmission.createMany({
      data: Array.from({ length: 5 }, () => ({
        extra: true,
        id: crypto.randomUUID(),
        itemIds: [],
        localDate: LOCAL_DATE,
        userId: user.id,
      })),
    });

    const start = ({ extra, id }: { extra: boolean; id: string }) =>
      prisma.$transaction(async (tx) => {
        await lockUsageForViewer({ transaction: tx, userId: user.id });
        const block = await tx.studySessionBlock.findUniqueOrThrow({ where: { id } });

        return admitWriting({
          extra,
          itemIds: [item.id],
          localDate: LOCAL_DATE,
          owner: { block },
          tx,
          userId: user.id,
        });
      });

    const admissions = await Promise.all(
      blocks.slice(0, 2).map(({ id }) => start({ extra: true, id })),
    );

    expect(admissions.map(({ status }) => status).toSorted()).toStrictEqual([
      "limitReached",
      "ready",
    ]);

    expect(admissions.find(({ status }) => status === "limitReached")).toMatchObject({
      returnsOn: "2026-11-21",
    });

    const scheduled = blocks.at(-1);

    if (!scheduled) {
      throw new Error(goal.id);
    }

    await expect(start({ extra: false, id: scheduled.id })).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("admits a written test as one unit and its complete answer set still grades the next day", async () => {
    const { goal, item, user } = await setup();

    const mock = await prisma.mockExam.create({
      data: { conditions: {}, goalId: goal.id, sectionStartedAt: LOCAL_DATE, userId: user.id },
    });

    const itemIds = [item.id, crypto.randomUUID()];

    const receipt = await prisma.$transaction(async (tx) => {
      await lockUsageForViewer({ transaction: tx, userId: user.id });

      return admitWriting({
        extra: true,
        itemIds,
        localDate: LOCAL_DATE,
        owner: { mock },
        tx,
        userId: user.id,
      });
    });

    if (receipt.status !== "ready") {
      throw new Error(receipt.status);
    }

    const { admissionId } = receipt;
    const nextDay = new Date("2026-11-21");

    await prisma.writingAdmission.createMany({
      data: Array.from({ length: 6 }, () => ({
        extra: true,
        id: crypto.randomUUID(),
        itemIds: [],
        localDate: nextDay,
        userId: user.id,
      })),
    });

    const attemptIds = itemIds.map((itemId) => getWritingAttemptId({ admissionId, itemId }));

    await expect(
      claimEssayGrades({ admissionId, attemptIds, userId: user.id }),
    ).resolves.toStrictEqual(attemptIds.map((attemptId) => ({ attemptId, status: "claimed" })));

    await expect(
      prisma.writingAdmission.count({
        where: { extra: true, localDate: LOCAL_DATE, userId: user.id },
      }),
    ).resolves.toBe(1);

    await expect(prisma.mockExam.findUnique({ where: { id: mock.id } })).resolves.toMatchObject({
      conditions: { writingAdmissionId: admissionId },
    });
  });
});
