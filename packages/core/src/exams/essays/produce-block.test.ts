import { describe, expect, it } from "vitest";
import { toProduceBlock } from "./produce-block";

describe(toProduceBlock, () => {
  it("reserves time and an identity before any prompt exists", () => {
    const block = toProduceBlock({
      minutes: 105,
      taskKey: "intervention",
      title: "Intervention proposal",
      unit: "answer",
    });

    expect(block).toMatchObject({
      estimatedMinutes: 105,
      kind: "produce",
      payload: {
        itemIds: [],
        writing: { admissionId: null, draft: null, taskKey: "intervention", unit: "answer" },
      },
    });
  });
});
