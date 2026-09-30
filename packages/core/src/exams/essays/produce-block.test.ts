import { describe, expect, it } from "vitest";
import { toProduceBlock } from "./produce-block";

const ESSAY_BLOCK_MINUTES = 20;

const PRODUCE = { itemId: "essay", skillId: "skill", title: "Intervention proposal" };

describe(toProduceBlock, () => {
  it("plans the essay when the day has room for it", () => {
    const block = toProduceBlock({
      examTrialEnded: false,
      freshStart: null,
      minBlockMinutes: 3,
      produce: PRODUCE,
      room: 45,
    });

    expect(block).toMatchObject({ estimatedMinutes: ESSAY_BLOCK_MINUTES, kind: "produce" });
    expect(block?.payload.itemIds).toStrictEqual(["essay"]);
  });

  it("leaves it out on short or light days and after a free exam trial", () => {
    const base = {
      examTrialEnded: false,
      freshStart: null,
      minBlockMinutes: 3,
      produce: PRODUCE,
      room: 45,
    };

    expect(toProduceBlock({ ...base, room: ESSAY_BLOCK_MINUTES })).toBeNull();
    expect(toProduceBlock({ ...base, freshStart: "welcomeBack" })).toBeNull();
    expect(toProduceBlock({ ...base, examTrialEnded: true })).toBeNull();
    expect(toProduceBlock({ ...base, produce: null })).toBeNull();
  });
});
