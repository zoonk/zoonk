import { numberedCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { keepPictures } from "./published-versions";

const provenance = { generatedAt: new Date(), model: "m", promptVersion: "p", runId: "r" };

function screen(content: object) {
  return { content, kind: "check" as const, mathItem: null, provenance, skillId: null };
}

describe(keepPictures, () => {
  it("keeps a drawing only for a screen asking for the same prompt, alt and numbered parts", () => {
    const previous = [{ ...screen(numberedCheckContent), ...provenance, mediaAssetId: "asset" }];
    const [petal, stigma, ovary] = numberedCheckContent.image.parts;
    const renumbered = { ...numberedCheckContent.image, parts: [ovary, petal, stigma] };

    const kept = keepPictures({
      previous,
      screens: [
        screen(numberedCheckContent),
        screen({ ...numberedCheckContent, image: renumbered }),
        screen({
          ...numberedCheckContent,
          image: { ...renumbered, alt: "A rose", parts: [petal, stigma, ovary] },
        }),
      ],
    });

    expect(kept.map((item) => item.mediaAssetId)).toStrictEqual(["asset", null, null]);
  });
});
