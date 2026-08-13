import { normalizePunctuation } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { deduplicateGeneratedItems } from "./deduplicate-generated-items";

describe(deduplicateGeneratedItems, () => {
  it("keeps the first item for each generated identity", () => {
    const items = [
      { text: "Morgen", translation: "morning" },
      { text: "Morgen", translation: "tomorrow" },
      { text: "morgen", translation: "tomorrow" },
    ];

    expect(deduplicateGeneratedItems({ getKey: (item) => item.text, items })).toStrictEqual([
      items[0],
      items[2],
    ]);
  });

  it("can use the same normalized identity as sentence persistence", () => {
    const items = [{ text: "Hallo !" }, { text: "Hallo!" }, { text: "hallo!" }];

    expect(
      deduplicateGeneratedItems({
        getKey: (item) => normalizePunctuation(item.text).toLowerCase(),
        items,
      }),
    ).toStrictEqual([items[0]]);
  });
});
