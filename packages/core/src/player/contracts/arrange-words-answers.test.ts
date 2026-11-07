import { describe, expect, it } from "vitest";
import {
  buildAcceptedArrangeWordSequences,
  matchesAcceptedArrangeWords,
} from "./arrange-words-answers";

describe(buildAcceptedArrangeWordSequences, () => {
  const canonical = ["Yesterday", "the", "bus", "arrived."];
  const other = ["The", "bus", "arrived", "yesterday."];

  it.each(["reading", "listening"] as const)(
    "accepts only the canonical and listed other orders for %s",
    (kind) => {
      const accepted = buildAcceptedArrangeWordSequences({
        kind,
        otherOrders: [other],
        text: "Yesterday the bus arrived.",
      });

      expect(accepted).toStrictEqual([canonical, other]);
      expect(matchesAcceptedArrangeWords(accepted, canonical)).toBe(true);
      expect(matchesAcceptedArrangeWords(accepted, other)).toBe(true);

      expect(matchesAcceptedArrangeWords(accepted, ["Yesterday", "bus", "the", "arrived."])).toBe(
        false,
      );

      expect(
        matchesAcceptedArrangeWords(accepted, [" THE ", "BUS!", "arrived,", "Yesterday"]),
      ).toBe(true);
    },
  );

  it("deduplicates normalized sequences while keeping the canonical first", () => {
    expect(
      buildAcceptedArrangeWordSequences({
        kind: "reading",
        otherOrders: [
          ["yesterday,", "THE", "BUS", "arrived!"],
          other,
          ["the,", "BUS", "arrived!", "YESTERDAY"],
        ],
        text: "Yesterday the bus arrived.",
      }),
    ).toStrictEqual([canonical, other]);
  });

  it.each(["", "…?!"])("has no accepted order for %j", (text) => {
    expect(
      buildAcceptedArrangeWordSequences({ kind: "reading", otherOrders: [], text }),
    ).toStrictEqual([]);
  });
});
