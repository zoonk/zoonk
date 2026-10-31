import { describe, expect, it } from "vitest";
import {
  misplacedItems,
  nextUnplacedId,
  placementsAnswer,
  unplacedItems,
} from "./categorize-placements";

const items = [{ id: "ice" }, { id: "wood" }, { id: "rust" }, { id: "sugar" }];

describe(placementsAnswer, () => {
  it("answers only once every item has a group", () => {
    expect(placementsAnswer(items, { ice: "physical", wood: "chemical" })).toBeNull();

    expect(
      placementsAnswer(items, {
        ice: "physical",
        rust: "chemical",
        sugar: "chemical",
        wood: "chemical",
      }),
    ).toStrictEqual({
      kind: "assignment",
      pairs: { ice: "physical", rust: "chemical", sugar: "chemical", wood: "chemical" },
    });
  });
});

describe(unplacedItems, () => {
  it("keeps the list order", () => {
    expect(unplacedItems(items, { wood: "chemical" }).map((item) => item.id)).toStrictEqual([
      "ice",
      "rust",
      "sugar",
    ]);
  });
});

describe(misplacedItems, () => {
  it("lists items whose group differs from the computed one", () => {
    expect(
      misplacedItems({
        expected: { ice: "physical", rust: "chemical", sugar: "physical", wood: "chemical" },
        items,
        placements: { ice: "physical", rust: "chemical", sugar: "chemical", wood: "chemical" },
      }),
    ).toStrictEqual([{ id: "sugar" }]);
  });
});

describe(nextUnplacedId, () => {
  it("moves forward to the next item left, wrapping around", () => {
    expect(nextUnplacedId({ items, placedId: "wood", placements: { wood: "c" } })).toBe("rust");

    expect(
      nextUnplacedId({ items, placedId: "sugar", placements: { rust: "c", sugar: "c" } }),
    ).toBe("ice");

    expect(
      nextUnplacedId({
        items,
        placedId: "sugar",
        placements: { ice: "p", rust: "c", sugar: "c", wood: "c" },
      }),
    ).toBeNull();
  });
});
