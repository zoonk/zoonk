import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { describe, expect, it } from "vitest";
import { examTestGoalFixture } from "../_test-utils/exam-test-goal";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";

async function readPace(chosen: number[]) {
  const durations = [...chosen, ...Array.from({ length: 10 }, () => 8000)];

  const { goal, items, user } = await examTestGoalFixture({
    subjects: [
      { items: durations.length, name: "Math", questions: 10 },
      { name: "Physics", questions: 8 },
      { name: "History", questions: 6 },
      { name: "Biology", questions: 4 },
    ],
  });

  await Promise.all(
    durations.map((durationMs, index) =>
      attemptFixture({
        answer: index < chosen.length ? { selectedIndex: 1 } : { dontKnow: true },
        durationMs,
        isCorrect: false,
        isPlacement: true,
        itemId: items[index]!.id,
        skillId: items[index]!.skillId,
        userId: user.id,
      }),
    ),
  );

  const finished = await finishGoalPlacement({ goalId: goal.id, input: {} });

  const record = readFocusTestRecord(
    await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
  );

  return { finished, summary: record?.summary };
}

describe("the learner's pace from chosen test answers", () => {
  it("keeps the starting pace until five chosen answers, despite quick unknown taps", async () => {
    const { finished, summary } = await readPace([60_000, 60_000, 60_000, 60_000]);
    expect(summary).toMatchObject({ paceMs: 60_000 });

    expect(finished).toMatchObject({
      completion: { focusTest: { offer: { minutes: 10, questions: 10 } } },
    });
  });

  it("excludes unknown taps from the own pace and caps each chosen answer", async () => {
    const { summary } = await readPace([60_000, 60_000, 60_000, 60_000, 900_000]);
    expect(summary).toMatchObject({ paceMs: 84_000 });
  });

  it("floors the saved pace and continuation estimate after fast chosen answers", async () => {
    const { finished, summary } = await readPace([150, 150, 150, 150, 150]);

    expect(summary).toMatchObject({ paceMs: 20_000 });

    expect(finished).toMatchObject({
      completion: { focusTest: { offer: { minutes: 3, questions: 10 } } },
    });
  });
});
