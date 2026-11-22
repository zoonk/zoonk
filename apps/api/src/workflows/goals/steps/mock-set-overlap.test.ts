import { checkRecallOverlap } from "@zoonk/ai/tasks/items/check-recall-overlap";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  textSetContent,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { taskResult } from "../../_test-utils/recorded-outputs";
import { screenMockSet } from "./mock-set-overlap";

describe(screenMockSet, () => {
  it("screens each skill's questions with their passage and preserves their order in the reserve", async () => {
    const [first, second, user] = await Promise.all([
      skillFixture(),
      skillFixture(),
      userFixture(),
    ]);

    const goal = await goalFixture({ kind: "exam", userId: user.id });

    await itemFixture({
      content: choiceItemContent("What was the original increase?"),
      skillId: first.id,
    });

    vi.mocked(checkRecallOverlap).mockResolvedValue(
      taskResult({
        repeats: [{ candidate: 0, earlier: 0, reason: "The earlier increase gives the answer." }],
      }),
    );

    const content = textSetContent("Changes in attendance");

    const items = [first, second, first].map((skill, index) => ({
      format: "typed" as const,
      item: {
        acceptedAnswers: ["five"],
        context: null,
        difficulty: "medium",
        format: "typed",
        image: null,
        keyPoints: ["The difference"],
        question: `What is the difference in row ${index + 1}?`,
        sampleAnswer: "five",
        visual: null,
      } satisfies GeneratedItem,
      skillId: skill.id,
    }));

    const checked = await screenMockSet({
      goalId: goal.id,
      set: { content, items, kind: "text", language: "en", provenance: taskResult({}).provenance },
      wait: "later",
      workflowRunId: crypto.randomUUID(),
    });

    expect(checkRecallOverlap).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        candidates: expect.arrayContaining([
          expect.objectContaining({ context: expect.stringContaining(content.text) }),
        ]),
        earlier: [
          expect.objectContaining({
            answer: "Right answer",
            question: expect.stringContaining("original increase"),
          }),
        ],
      }),
    );

    expect(checked).toMatchObject({ items: items.slice(1), mockOnly: true });
  });
});
