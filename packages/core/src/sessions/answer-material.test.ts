import { describe, expect, it } from "vitest";
import { type AnswerRecord, classifyAnswers } from "./answer-material";

function answer({
  at,
  id,
  isCorrect = true,
  itemId = null,
  stepId = null,
}: {
  at: string;
  id: string;
  isCorrect?: boolean;
  itemId?: string | null;
  stepId?: string | null;
}): AnswerRecord {
  return { answeredAt: new Date(at), id, isCorrect, itemId, stepId };
}

describe(classifyAnswers, () => {
  it("marks capsule and drill questions due, first right answers new and later ones repeats", () => {
    const history = [
      answer({ at: "2026-09-20T10:00:00Z", id: "old-right", itemId: "known" }),
      answer({ at: "2026-09-21T10:00:00Z", id: "old-wrong", isCorrect: false, itemId: "missed" }),
      answer({ at: "2026-09-22T10:00:00Z", id: "old-step", stepId: "step" }),
      answer({ at: "2026-09-23T10:00:00Z", id: "old-step-2", stepId: "step" }),
    ];

    const today = [
      answer({ at: "2026-09-30T10:00:00Z", id: "a", itemId: "capsule" }),
      answer({ at: "2026-09-30T10:01:00Z", id: "b", itemId: "known" }),
      answer({ at: "2026-09-30T10:02:00Z", id: "c", itemId: "missed" }),
      answer({ at: "2026-09-30T10:03:00Z", id: "d", stepId: "step" }),
    ];

    const classified = classifyAnswers({
      answers: today,
      dueItemIds: new Set(["capsule"]),
      history: [...history, ...today],
    });

    expect(
      classified.map((item) => [item.id, item.material, item.priorRightAnswers]),
    ).toStrictEqual([
      ["a", "due", 0],
      ["b", "repeat", 1],
      ["c", "new", 0],
      ["d", "repeat", 2],
    ]);
  });
});
