import { describe, expect, it } from "vitest";
import { splitLessonItems } from "./split-lesson-items";

describe(splitLessonItems, () => {
  it("keeps lessons with at most twenty items together", () => {
    const items = Array.from({ length: 20 }, (_, index) => index + 1);

    expect(splitLessonItems(items)).toStrictEqual([items]);
  });

  it("balances twenty-one items across two lessons without changing their order", () => {
    const items = Array.from({ length: 21 }, (_, index) => ({
      translation: `Translation ${index + 1}`,
      word: `Word ${index + 1}`,
    }));

    const groups = splitLessonItems(items);

    expect(groups.map((group) => group.length)).toStrictEqual([11, 10]);
    expect(groups.flat()).toStrictEqual(items);
  });

  it("balances forty-one items across three lessons", () => {
    const items = Array.from({ length: 41 }, (_, index) => index + 1);

    const groups = splitLessonItems(items);

    expect(groups.map((group) => group.length)).toStrictEqual([14, 14, 13]);
    expect(groups.flat()).toStrictEqual(items);
  });
});
