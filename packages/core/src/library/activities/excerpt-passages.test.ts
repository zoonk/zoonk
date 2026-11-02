import { describe, expect, it } from "vitest";
import { hasOverlappingPassages, splitExcerpt } from "./excerpt-passages";

const excerpt =
  "On our coming near them they fired one or two shots, upon which our men rushed in.";

describe(splitExcerpt, () => {
  it("splits an excerpt into plain text and passages in reading order", () => {
    const segments = splitExcerpt(excerpt, [
      { id: "rushed", text: "our men rushed in" },
      { id: "shots", text: "they fired one or two shots" },
    ]);

    expect(segments).toStrictEqual([
      { passageId: null, text: "On our coming near them " },
      { passageId: "shots", text: "they fired one or two shots" },
      { passageId: null, text: ", upon which " },
      { passageId: "rushed", text: "our men rushed in" },
      { passageId: null, text: "." },
    ]);

    expect(segments.map((segment) => segment.text).join("")).toBe(excerpt);
  });

  it("keeps a passage at the very start or end without empty pieces", () => {
    expect(
      splitExcerpt("They fired first.", [{ id: "a", text: "They fired first." }]),
    ).toStrictEqual([{ passageId: "a", text: "They fired first." }]);
  });

  it("leaves out passages that aren't in the excerpt and later overlapping ones", () => {
    const segments = splitExcerpt(excerpt, [
      { id: "missing", text: "a volley" },
      { id: "shots", text: "fired one or two" },
      { id: "overlap", text: "two shots, upon" },
    ]);

    expect(segments.map((segment) => segment.passageId)).toStrictEqual([null, "shots", null]);
  });
});

describe(hasOverlappingPassages, () => {
  it("finds passages that share words", () => {
    expect(
      hasOverlappingPassages(excerpt, [
        { id: "a", text: "they fired one" },
        { id: "b", text: "one or two shots" },
      ]),
    ).toBe(true);

    expect(
      hasOverlappingPassages(excerpt, [
        { id: "a", text: "they fired" },
        { id: "b", text: "one or two shots" },
      ]),
    ).toBe(false);
  });
});
