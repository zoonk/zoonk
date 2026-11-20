import { describe, expect, it } from "vitest";
import { type MindMapsPageChapter, orderNotMade } from "./mind-maps-page";

function chapter(
  id: string,
  { lessonsToWrite = 2, status = "available" }: Partial<MindMapsPageChapter> = {},
): MindMapsPageChapter {
  return {
    chapterId: id,
    lessonsToWrite,
    position: 1,
    saved: false,
    status,
    subject: null,
    thumbnailUrl: null,
    title: id,
  };
}

const ids = (chapters: readonly MindMapsPageChapter[]) => chapters.map((item) => item.chapterId);

describe(orderNotMade, () => {
  it("shows every chapter when a few more than the first rows", () => {
    const chapters = ["a", "b", "c", "d", "e", "f", "g"].map((id) => chapter(id));
    const { next, rest } = orderNotMade({ chapters, studied: new Set() });

    expect(ids(next)).toStrictEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(rest).toStrictEqual([]);
  });

  it("leads with maps on their way, then written chapters, then studied ones", () => {
    const chapters = [
      chapter("a"),
      chapter("b"),
      chapter("studied"),
      chapter("written", { lessonsToWrite: 0 }),
      chapter("c"),
      chapter("drawing", { lessonsToWrite: 0, status: "drawing" }),
      chapter("d"),
      chapter("e"),
    ];

    const { next, rest } = orderNotMade({ chapters, studied: new Set(["studied"]) });

    expect(ids(next)).toStrictEqual(["drawing", "written", "studied", "a", "b"]);
    expect(ids(rest)).toStrictEqual(["c", "d", "e"]);
  });
});
