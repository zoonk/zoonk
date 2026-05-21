import { describe, expect, it } from "vitest";
import { getPlayerResourceIds } from "./get-player-resource-ids";

describe(getPlayerResourceIds, () => {
  it("returns exact chapter resource ids from playable steps", () => {
    const result = getPlayerResourceIds({
      steps: [
        { chapterSentenceId: null, chapterWordId: "word-1" },
        { chapterSentenceId: "sentence-1", chapterWordId: null },
        { chapterSentenceId: "sentence-2", chapterWordId: "word-2" },
      ],
    });

    expect(result).toStrictEqual({
      chapterSentenceIds: ["sentence-1", "sentence-2"],
      chapterWordIds: ["word-1", "word-2"],
    });
  });

  it("deduplicates ids without changing first-seen order", () => {
    const result = getPlayerResourceIds({
      steps: [
        { chapterSentenceId: "sentence-1", chapterWordId: "word-1" },
        { chapterSentenceId: "sentence-1", chapterWordId: "word-2" },
        { chapterSentenceId: "sentence-2", chapterWordId: "word-1" },
      ],
    });

    expect(result).toStrictEqual({
      chapterSentenceIds: ["sentence-1", "sentence-2"],
      chapterWordIds: ["word-1", "word-2"],
    });
  });

  it("returns empty lists when steps have no language resources", () => {
    const result = getPlayerResourceIds({
      steps: [
        { chapterSentenceId: null, chapterWordId: null },
        { chapterSentenceId: null, chapterWordId: null },
      ],
    });

    expect(result).toStrictEqual({ chapterSentenceIds: [], chapterWordIds: [] });
  });
});
