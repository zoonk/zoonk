import { describe, expect, it } from "vitest";
import { toProduceBlock } from "./produce-block";

const ESSAY_BLOCK_MINUTES = 20;

const PRODUCE = {
  itemId: "essay",
  minutes: ESSAY_BLOCK_MINUTES,
  skillId: "skill",
  title: "Intervention proposal",
};

describe(toProduceBlock, () => {
  it("plans the essay when the day has room for it", () => {
    const block = toProduceBlock({
      freshStart: null,
      minBlockMinutes: 3,
      produce: PRODUCE,
      room: 45,
    });

    expect(block).toMatchObject({ estimatedMinutes: ESSAY_BLOCK_MINUTES, kind: "produce" });
    expect(block?.payload.itemIds).toStrictEqual(["essay"]);
  });

  it("takes the essay's own minutes: a class test's discursive answer fits a short day", () => {
    const block = toProduceBlock({
      freshStart: null,
      minBlockMinutes: 3,
      produce: { ...PRODUCE, minutes: 8 },
      room: 20,
    });

    expect(block).toMatchObject({ estimatedMinutes: 8, kind: "produce" });
  });
});
