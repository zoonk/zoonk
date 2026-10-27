import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";

const CASES = [
  { kind: "practice", planStatus: "done", status: "completed" },
  { kind: "learn", planStatus: "done", status: "completed" },
  { kind: "empty", planStatus: "todo", status: "skipped" },
] as const;

type CompletionKind = (typeof CASES)[number]["kind"];

const PLAN_KINDS = { empty: "boss", learn: "lesson", practice: "review" } as const;

async function setup(kind: CompletionKind) {
  const [user, skill, lesson] = await Promise.all([
    userFixture(),
    skillFixture(),
    libraryLessonFixture(),
  ]);

  const { goal, plan } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  const planItem = await planItemFixture({
    kind: PLAN_KINDS[kind],
    lessonId: kind === "learn" ? lesson.id : null,
    planId: plan.id,
    skillId: skill.id,
  });

  const session = await studySessionFixture({
    goalId: goal.id,
    missions: { picks: [], version: 1 },
    startedAt: new Date(),
    status: "active",
    userId: user.id,
  });

  const block = await studySessionBlockFixture({
    kind: kind === "empty" ? "checkpoint" : kind,
    lessonId: kind === "learn" ? lesson.id : null,
    payload: toBlockPayload({
      checkpoint:
        kind === "empty"
          ? {
              kind: "boss",
              mock: false,
              passMark: 1,
              phase: 0,
              rematch: false,
              timeLimitMinutes: null,
            }
          : null,
      itemIds: [item.id],
      planItemId: planItem.id,
    }),
    position: 0,
    sessionId: session.id,
    startedAt: new Date(Date.now() - 60_000),
    status: "active",
  });
  // Keep the day open, so its separate session completion cannot hide this block's gap.
  const later = await studySessionBlockFixture({
    kind: "practice",
    position: 1,
    sessionId: session.id,
  });

  await prepareCompletion({ block, item, kind, lesson, session, user });
  mockSession(user.id);
  return { block, later, plan, planItem, session, user };
}

async function prepareCompletion({
  block,
  item,
  kind,
  lesson,
  session,
  user,
}: {
  block: Awaited<ReturnType<typeof studySessionBlockFixture>>;
  item: Awaited<ReturnType<typeof itemFixture>>;
  kind: CompletionKind;
  lesson: Awaited<ReturnType<typeof libraryLessonFixture>>;
  session: Awaited<ReturnType<typeof studySessionFixture>>;
  user: Awaited<ReturnType<typeof userFixture>>;
}) {
  if (kind === "learn") {
    await learningEventFixture({
      contentIds: { lessonId: lesson.id, studySessionBlockId: block.id },
      userId: user.id,
    });

    return;
  }

  if (kind === "empty") {
    await prisma.item.delete({ where: { id: item.id } });
    return;
  }

  await attemptFixture({
    answer: { selectedIndex: 0 },
    isCorrect: true,
    itemId: item.id,
    skillId: item.skillId,
    studySessionId: session.id,
    userId: user.id,
  });
}

async function versions({ plan }: Awaited<ReturnType<typeof setup>>) {
  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  return { inputVersion: saved.inputVersion };
}

function finish({ block, session }: Awaited<ReturnType<typeof setup>>) {
  return finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });
}

async function assertCompleted({
  day,
  planStatus,
  status,
}: { day: Awaited<ReturnType<typeof setup>> } & Pick<
  (typeof CASES)[number],
  "planStatus" | "status"
>) {
  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: day.block.id } }),
  ).resolves.toMatchObject({ status });

  await expect(
    prisma.planItem.findUniqueOrThrow({ where: { id: day.planItem.id } }),
  ).resolves.toMatchObject({ status: planStatus });

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: day.later.id } }),
  ).resolves.toMatchObject({ status: "pending" });

  await expect(
    prisma.studySession.findUniqueOrThrow({ where: { id: day.session.id } }),
  ).resolves.toMatchObject({ status: "active" });
}

describe("block completions before the day finishes", () => {
  it.each(CASES)(
    "marks $kind once and rolls back a replay",
    async ({ kind, planStatus, status }) => {
      const day = await setup(kind);
      const before = await versions(day);
      await expect(finish(day)).resolves.toMatchObject({ status: "ready" });
      await assertCompleted({ day, planStatus, status });

      const after = { inputVersion: before.inputVersion + 1 };

      await expect(versions(day)).resolves.toStrictEqual(after);
      await finish(day);
      await expect(versions(day)).resolves.toStrictEqual(after);
    },
  );

  it.each(CASES)(
    "commits one $kind for concurrent completions",
    async ({ kind, planStatus, status }) => {
      const day = await setup(kind);
      const before = await versions(day);
      const results = await Promise.all([finish(day), finish(day)]);

      expect(
        results.every((result) => result.status === "ready" || result.status === "blockFinished"),
      ).toBe(true);

      await assertCompleted({ day, planStatus, status });

      await expect(versions(day)).resolves.toStrictEqual({ inputVersion: before.inputVersion + 1 });
    },
  );
});
