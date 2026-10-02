import { describe, expect, it } from "vitest";
import { bankTiles, builtSentence, correctionWords, isAcceptedSentence } from "./sentence-bank";

const fields = {
  distractors: [
    { why: "Formal in Spain.", word: "Vienen" },
    { why: "The noun.", word: "cena" },
  ],
  target: "¿Venís a cenar esta noche?",
};

describe(bankTiles, () => {
  it("mixes the target's words with the distractors, without punctuation", () => {
    const tiles = bankTiles(fields);

    expect(tiles.map((tile) => tile.text).toSorted()).toStrictEqual(
      ["Venís", "a", "cenar", "esta", "noche", "Vienen", "cena"].toSorted(),
    );

    expect(tiles.find((tile) => tile.text === "Vienen")?.why).toBe("Formal in Spain.");
    expect(bankTiles(fields)).toStrictEqual(tiles);
  });

  it("never lays the tiles out in the answer's order", () => {
    const tiles = bankTiles({ distractors: [{ why: "No.", word: "b" }], target: "a c" });
    expect(tiles.slice(0, 2).map((tile) => tile.id)).not.toStrictEqual(["t0", "t1"]);
  });
});

describe("built sentences", () => {
  it("spells the placed tiles and accepts it the way core grades", () => {
    const tiles = bankTiles(fields);

    const ids = ["Venís", "a", "cenar", "esta", "noche"].map(
      (text) => tiles.find((tile) => tile.text === text)?.id ?? "",
    );

    const sentence = builtSentence(tiles, ids);

    expect(sentence).toBe("Venís a cenar esta noche");
    expect(isAcceptedSentence(sentence, [fields.target])).toBe(true);
    expect(isAcceptedSentence("Vienen a cenar esta noche", [fields.target])).toBe(false);
  });
});

describe(correctionWords, () => {
  it("marks the words the learner's sentence didn't have", () => {
    expect(
      correctionWords("¿Venís a cenar esta noche?", "Vienen a cenar esta noche"),
    ).toStrictEqual([
      { isNew: true, word: "¿Venís" },
      { isNew: false, word: "a" },
      { isNew: false, word: "cenar" },
      { isNew: false, word: "esta" },
      { isNew: false, word: "noche?" },
    ]);
  });
});
