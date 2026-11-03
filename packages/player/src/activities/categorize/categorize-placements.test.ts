import { describe, expect, it } from "vitest";
import {
  misplacedItems,
  placementsAnswer,
  sortCard,
  takeBackLastCard,
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

describe(takeBackLastCard, () => {
  it("takes back the cards in the reverse order they were sorted", () => {
    const first = sortCard({
      groupId: "physical",
      itemId: "ice",
      state: { history: [], placements: {} },
    });

    const second = sortCard({ groupId: "chemical", itemId: "wood", state: first });

    expect(takeBackLastCard(second)).toStrictEqual({
      history: ["ice"],
      placements: { ice: "physical" },
    });

    expect(takeBackLastCard(takeBackLastCard(second))).toStrictEqual({
      history: [],
      placements: {},
    });
  });

  it("leaves a sort with nothing to take back as it is", () => {
    const sorted = { history: [], placements: { ice: "physical" } };
    expect(takeBackLastCard(sorted)).toBe(sorted);
  });
});
