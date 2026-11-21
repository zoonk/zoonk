import { writeListeningSet } from "@zoonk/ai/tasks/listening/write-set";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { mockWrittenListeningSet } from "../../library/listening/_test-utils/written-listening-set";
import { getLanguageLevelTestOut, startLanguageLevelTestOut } from "./language-level-test-out";
import {
  finishLevelTestOutPreparation,
  readLevelTestOutPreparation,
  writeLevelTestOutListeningSet,
} from "./prepare-language-level-test-out";

describe("preparing level test-out questions", () => {
  it("owes work once on start and waits for a voiced set before exposing questions", async () => {
    const { goal, skills, user } = await languageGoalFixture();
    const [topic] = skills;

    if (!topic) {
      throw new Error("Expected a level topic");
    }

    await prisma.skill.update({ data: { cefrLevel: "C2" }, where: { id: topic.id } });
    mockSession(user.id);

    const start = () => startLanguageLevelTestOut({ goalId: goal.id, level: "C2" });
    const opened = await start();

    if (opened.status !== "ready") {
      throw new Error(`Expected a saved test-out, got ${opened.status}`);
    }

    const input = { attemptId: opened.test.attemptId, goalId: goal.id, userId: user.id };
    expect(opened.test).toMatchObject({ next: null, preparing: true, total: 0 });
    await expect(getLanguageLevelTestOut(input)).resolves.toStrictEqual(opened);
    await expect(start()).resolves.toStrictEqual(opened);

    await expect(
      prisma.followUp.findMany({ where: { kind: "preparePlacementItems", userId: user.id } }),
    ).resolves.toMatchObject([
      {
        input: { goalId: goal.id, levelTestOutAttemptId: input.attemptId, skillIds: [topic.id] },
        revision: 0,
      },
    ]);

    const set = await listeningSetFixture();

    const orders = ["Visit", "Book", "Sign"].map((last) => ({
      question: "Order the steps",
      reason: "The speaker describes that sequence.",
      steps: ["Ask", "Confirm", "Pay", last],
    }));

    await Promise.all([
      itemFixture({ content: choiceItemContent(), skillId: topic.id }),
      itemFixture({
        content: choiceItemContent(),
        setId: set.id,
        setPosition: 0,
        skillId: topic.id,
      }),
      ...orders.flatMap((content, index) => [
        itemFixture({ content, format: "order", skillId: topic.id }),
        itemFixture({
          content,
          format: "order",
          setId: set.id,
          setPosition: index + 1,
          skillId: topic.id,
        }),
      ]),
    ]);

    await expect(readLevelTestOutPreparation(input)).resolves.toMatchObject({
      listening: false,
      questions: [],
      unvoicedSetId: set.id,
    });

    const media = await mediaAssetFixture({ durationMs: 30_000, kind: "audio" });
    await prisma.itemSet.update({ data: { mediaAssetId: media.id }, where: { id: set.id } });
    await finishLevelTestOutPreparation(input);

    await expect(getLanguageLevelTestOut(input)).resolves.toMatchObject({
      status: "ready",
      test: { next: { skill: "reading" }, preparing: false, total: 8 },
    });
  });

  it("writes one probe and three ordering questions for the sampled listening topic", async () => {
    const { set } = mockWrittenListeningSet();
    const choice = set.questions[0];

    if (!choice) {
      throw new Error("Expected a probe");
    }

    set.questions = [
      choice,
      ...["setup", "packing", "travel"].map((stage) => ({
        difficulty: "medium" as const,
        evidence: `The speaker describes ${stage}`,
        format: "order" as const,
        question: `What order did the speakers give for ${stage}?`,
        reason: "Listen for the changes they made.",
        skill: 1,
        steps: ["Paint", "Measure", "Rehearse", "Clean"],
      })),
    ];

    const topic = { description: "Follow changes to a schedule.", id: "topic", name: "Plans" };

    const written = await writeLevelTestOutListeningSet({
      analytics: {},
      language: "pt",
      level: "C1",
      scriptLanguage: "en",
      serviceTier: "priority",
      topic,
    });

    expect(writeListeningSet).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 4,
        formats: ["multipleChoice", "order"],
        level: "C1",
        skills: [topic],
      }),
    );

    expect(written.kind).toBe("audio");
    expect(written.minItems).toBe(4);

    expect(written.items.map(({ format }) => format)).toStrictEqual([
      "multipleChoice",
      "order",
      "order",
      "order",
    ]);

    expect(written.items.every(({ skillId }) => skillId === topic.id)).toBe(true);
  });
});
