import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { bodyMedia, findManifests, manifestsAbove } from "./locate.mts";

describe("the pictures a PR body shows", () => {
  it("lists each ![description](path) once, in order, remote ones included", () => {
    const body = [
      "| ![](media/today-before.png) | ![After: today](media/final/today.png) |",
      '[![](media/plan.png)](https://example.com) and ![](media/final/today.png "again")',
      "![](https://github.com/user-attachments/assets/abc)",
      "[a link to notes, not media](media/notes.md)",
    ].join("\n");

    assert.deepEqual(bodyMedia(body), {
      pictures: [
        "media/today-before.png",
        "media/final/today.png",
        "media/plan.png",
        "https://github.com/user-attachments/assets/abc",
      ],
      unsupported: [],
    });
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
      found.every(({ pictures, unsupported }) => pictures.length === 0 && unsupported.length > 0),
    );
  });
});

describe("where the check looks for capture manifests", () => {
  it("walks up from each picture, and searches named folders without node_modules", async () => {
    const root = mkdtempSync(join(tmpdir(), "pr-media-find-"));

    for (const folder of ["tmp/pr-media/after", "elsewhere", "node_modules/pkg"]) {
      mkdirSync(join(root, folder), { recursive: true });
      writeFileSync(join(root, folder, "capture.json"), "[]");
    }

    const picture = join(root, "tmp/pr-media/after/phone/light/today.png");

    assert.deepEqual(manifestsAbove([picture]), [join(root, "tmp/pr-media/after")]);

    assert.deepEqual(await findManifests(root), [
      join(root, "elsewhere"),
      join(root, "tmp/pr-media/after"),
    ]);
  });
});
