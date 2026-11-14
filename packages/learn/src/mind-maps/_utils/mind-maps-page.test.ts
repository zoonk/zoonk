import { describe, expect, it } from "vitest";
import { type MindMapsPageChapter, countChapterMaps } from "./mind-maps-page";

function chapter(
  fields: Pick<MindMapsPageChapter, "lessonsToWrite" | "status">,
): MindMapsPageChapter {
  return {
    chapterId: crypto.randomUUID(),
    position: 1,
    saved: false,
    subject: null,
    thumbnailUrl: null,
    title: "Chapter",
    ...fields,
  };
}

describe(countChapterMaps, () => {
  it("counts as failed only the maps creating all chapter maps retries", () => {
    const counts = countChapterMaps([
      chapter({ lessonsToWrite: 0, status: "failed" }),
      chapter({ lessonsToWrite: 4, status: "failed" }),
    ]);

    expect(counts.failed).toBe(1);
  });
});
