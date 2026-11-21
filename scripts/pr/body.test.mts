import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { bodyMedia } from "./body.mts";

const links = (markdown: string) => bodyMedia(markdown).images.map(({ link }) => link);

describe("the images a PR body shows", () => {
  it("lists every occurrence in order, remote ones included", () => {
    const body = [
      "| ![](media/today-before.png) | ![After: today](media/final/today.png) |",
      "| --- | --- |",
      "",
      '[![](media/plan.png)](https://example.com) and ![](media/final/today.png "again")',
      "![](https://github.com/user-attachments/assets/abc)",
      "[a link to notes, not media](media/notes.md)",
    ].join("\n");

    assert.deepEqual(links(body), [
      "media/today-before.png",
      "media/final/today.png",
      "media/plan.png",
      "media/final/today.png",
      "https://github.com/user-attachments/assets/abc",
    ]);

    assert.deepEqual(bodyMedia(body).unsupported, []);
  });

  it("finds one nested anywhere: emphasis, a list, a quote, a folded block", () => {
    const body = [
      "**![](bold.png)**",
      "",
      "- ![](listed.png)",
      "",
      "> ![](quoted.png)",
      "",
      "<details>",
      "",
      "![](folded.png)",
      "",
      "</details>",
    ].join("\n");

    assert.deepEqual(links(body), ["bold.png", "listed.png", "quoted.png", "folded.png"]);
  });

  it("names every other way of showing media instead of leaving it unchecked", () => {
    const forms = [
      "![After][shot]\n\n[shot]: https://example.com/after.png",
      "<img src='https://example.com/after.png'>",
      "<img src=https://example.com/after.png>",
      '<img src="media/plan.png" width="300">',
      '<video src="https://example.com/after.mp4"></video>',
      "![After](<missing image.png>)",
      "The new screen is in media/after.png.",
    ];

    const found = forms.map((form) => bodyMedia(form));

    assert.ok(
      found.every(({ images, unsupported }) => images.length === 0 && unsupported.length > 0),
    );
  });

  it("reads a file name in code as text, since code never shows media", () => {
    const body = [
      "| Finding | Pictures | Closed |",
      "| --- | --- | --- |",
      "| The helper sits low | `after/phone/light/today.png`, `after/laptop/light/today.png` | Not a fault: the base has it too |",
      "",
      "Replaces ``public/og.png`` and `<img src='logo.png'>`.",
      "",
      "```sh",
      "pnpm pr:media device after/phone/light/today.png",
      "```",
    ].join("\n");

    assert.deepEqual(bodyMedia(body), { images: [], unsupported: [] });
  });
});
