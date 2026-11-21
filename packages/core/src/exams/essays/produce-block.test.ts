import { describe, expect, it } from "vitest";
import { toDayBlockView } from "../../sessions/_utils/day-block-view";
import { toProduceBlock } from "./produce-block";

describe(toProduceBlock, () => {
  it.each(["drill", "answer"] as const)("shows the %s unit before a prompt is assigned", (unit) => {
    const produce = toProduceBlock({ minutes: 8, taskKey: "argument", title: "Argument", unit });
    const block = { ...produce, brainPower: 0, position: 0, status: "pending" as const };

    expect(toDayBlockView({ answeredItemIds: new Set(), block })).toMatchObject({
      title: "Argument",
      writingAvailability: { status: "available" },
      writingUnit: unit,
    });
  });

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
