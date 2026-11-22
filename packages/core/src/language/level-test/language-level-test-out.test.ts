import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadTodayPlanChange } from "../../plans/_utils/today-plan-change";
import { recordTestOutChange } from "../../plans/record-test-out-change";
import { finishLanguageLevelTestOut } from "./finish-language-level-test-out";
import {
  type LanguageLevelTestOutResult,
  answerLanguageLevelTestOut,
  startLanguageLevelTestOut,
} from "./language-level-test-out";
import { startLanguageLevelTest } from "./start-language-level-test";

async function writeTapQuestions({ setId, skillId }: { setId?: string; skillId: string }) {
  const quick = choiceItemContent();

  const all = {
    ...choiceItemContent(),
    options: Array.from({ length: 5 }, (_, index) => ({
      isCorrect: index < 2,
      misconception: null,
      reason: "Explanation.",
      text: `Option ${index + 1}`,
    })),
    select: "all",
  };

  return Promise.all(
    [quick, all, all, all].map((content, setPosition) =>
      itemFixture({ content, setId, setPosition: setId ? setPosition : null, skillId }),
    ),
  );
}

async function takeTest({
  goalId,
  seenSkills,
  view,
}: {
  goalId: string;
  seenSkills: Set<"reading" | "listening">;
  view: Extract<LanguageLevelTestOutResult, { status: "ready" }>["test"];
}) {
  const { next } = view;

  if (!next) {
    return;
  }

  seenSkills.add(next.skill);

  expect(Boolean(next.set?.listening?.audio?.url)).toBe(next.skill === "listening");

  const answer = next.select === "all" ? { selectedIndexes: [0, 1] } : { selectedIndex: 0 };

  const result = await answerLanguageLevelTestOut({
    goalId,
    input: { answer, attemptId: view.attemptId, durationMs: 1500, itemId: next.itemId },
  });

  if (result.status !== "ready") {
    throw new Error(`Answer returned ${result.status}`);
  }

  await takeTest({ goalId, seenSkills, view: result.test });
}

describe("a language level test-out", () => {
  it("confirms one topic in each assessed skill and only skips lessons that teach them", async () => {
    const { goal, items, skills, user } = await languageGoalFixture();
    const [reading, listening, untested] = skills;

    if (!reading || !listening || !untested) {
      throw new Error("Expected three topics");
    }

    const media = await mediaAssetFixture({ durationMs: 30_000, kind: "audio" });
    const set = await listeningSetFixture({ mediaAssetId: media.id });

    await Promise.all([
      prisma.skill.updateMany({
        data: { cefrLevel: "C2" },
        where: { id: { in: [reading.id, listening.id, untested.id] } },
      }),
      writeTapQuestions({ skillId: reading.id }),
      writeTapQuestions({ setId: set.id, skillId: listening.id }),
    ]);

    mockSession(user.id);
    const started = await startLanguageLevelTestOut({ goalId: goal.id, level: "C2" });

    if (started.status !== "ready") {
      throw new Error(`Start returned ${started.status}`);
    }

    expect(started.test).toMatchObject({ answered: 0, level: "C2", total: 8 });

    await expect(
      startLanguageLevelTest({ goalId: goal.id, length: "quick" }),
    ).resolves.toMatchObject({ status: "invalid" });

    const seenSkills = new Set<"reading" | "listening">();
    await takeTest({ goalId: goal.id, seenSkills, view: started.test });
    expect(seenSkills).toStrictEqual(new Set(["reading", "listening"]));

    const input = { attemptId: started.test.attemptId, goalId: goal.id };
    const finished = await finishLanguageLevelTestOut(input);

    expect(finished).toMatchObject({
      status: "ready",
      test: {
        answered: 8,
        next: null,
        result: { changeId: null, lessonsSkipped: 2, topicsSkipped: [reading.id, listening.id] },
      },
    });

    await expect(finishLanguageLevelTestOut(input)).resolves.toStrictEqual(finished);

    await recordTestOutChange({
      goalId: goal.id,
      itemIds: items.slice(0, 2).map(({ id }) => id),
      receipt: `levelTestOut:${input.attemptId}`,
      timeZone: "UTC",
      userId: user.id,
    });

    const recorded = await finishLanguageLevelTestOut(input);

    await expect(loadTodayPlanChange({ goal, now: new Date() })).resolves.toMatchObject({
      canUndo: true,
      id: recorded.status === "ready" ? recorded.test.result?.changeId : null,
    });

    const statuses = await prisma.planItem.findMany({
      select: { id: true, status: true },
      where: { id: { in: items.slice(0, 3).map(({ id }) => id) } },
    });

    const statusByItem = new Map(statuses.map(({ id, status }) => [id, status]));

    expect(items.slice(0, 3).map(({ id }) => statusByItem.get(id))).toStrictEqual([
      "testedOut",
      "testedOut",
      "todo",
    ]);
  });
});
