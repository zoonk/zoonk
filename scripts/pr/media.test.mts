import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type CaptureItem, renderMedia } from "./media.mts";

function shot(name: string, viewport: "laptop" | "phone" = "phone"): CaptureItem {
  return { file: `${viewport}/light/${name}.png`, kind: "shot", name, scheme: "light", viewport };
}

const VIDEO: CaptureItem = {
  file: "phone/light.webm",
  kind: "video",
  scheme: "light",
  viewport: "phone",
};

const SIDES = {
  after: [shot("today"), shot("plan"), shot("today", "laptop"), VIDEO],
  before: [shot("today"), shot("plan"), shot("today", "laptop"), VIDEO],
};

describe("the before-and-after section", () => {
  it("puts each screen and each video in its own panel, with only the first one open", () => {
    const { markdown } = renderMedia({ root: "tmp/pr-media", sides: SIDES });

    assert.deepEqual(
      markdown
        .split("\n")
        .filter((line) => line.startsWith("<details") || line.startsWith("<summary")),
      [
        "<details open>",
        "<summary>today</summary>",
        "<details>",
        "<summary>plan</summary>",
        "<details>",
        "<summary>Video · phone · light</summary>",
      ],
    );

    assert.match(
      markdown,
      /<summary>today<\/summary>\n\n\| \| Before \| After \|\n\| --- \| --- \| --- \|\n\| phone · light \| !\[Before: today · phone · light\]\(tmp\/pr-media\/before\/phone\/light\/today\.png\) \| !\[After: today · phone · light\]\(tmp\/pr-media\/after\/phone\/light\/today\.png\) \|\n\| laptop · light \| .+ \|\n\n<\/details>/u,
    );
  });

  it("keeps each video alone in its paragraph so GitHub plays it", () => {
    const { markdown } = renderMedia({ root: "tmp/pr-media", sides: SIDES });

    assert.match(
      markdown,
      /\*\*Before\*\*\n\n!\[\]\(tmp\/pr-media\/before\/phone\/light\.webm\)\n\n\*\*After\*\*\n\n!\[\]\(tmp\/pr-media\/after\/phone\/light\.webm\)\n\n<\/details>/u,
    );
  });

  it("leaves out pairs where nothing changed, along with their files", () => {
    const { attachments, markdown } = renderMedia({
      root: "tmp/pr-media",
      sides: SIDES,
      unchanged: new Set(["plan · phone · light"]),
    });

    assert.doesNotMatch(markdown, /plan/u);

    assert.deepEqual(attachments, [
      "tmp/pr-media/before/phone/light/today.png",
      "tmp/pr-media/after/phone/light/today.png",
      "tmp/pr-media/before/laptop/light/today.png",
      "tmp/pr-media/after/laptop/light/today.png",
      "tmp/pr-media/before/phone/light.webm",
      "tmp/pr-media/after/phone/light.webm",
    ]);
  });

  it("marks the missing side of a new screen", () => {
    const { markdown } = renderMedia({
      root: "tmp/pr-media",
      sides: { after: [shot("goals")], before: [] },
    });

    assert.match(markdown, /\| phone · light \| – \| !\[After: goals · phone · light\]/u);
  });
});
