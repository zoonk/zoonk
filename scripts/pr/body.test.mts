import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { DEVICE_HEADING, bodyMedia } from "./body.mts";

const CAPTION =
  "Pixel 9, Android 16; build not verified, installed 2026-11-15T10:00:00.000Z, app 1.0";

describe("the pictures a PR body shows", () => {
  it("lists each ![description](path) once, in order, remote ones included", () => {
    const body = [
      "| ![](media/today-before.png) | ![After: today](media/final/today.png) |",
      '[![](media/plan.png)](https://example.com) and ![](media/final/today.png "again")',
      "![](https://github.com/user-attachments/assets/abc)",
      "[a link to notes, not media](media/notes.md)",
    ].join("\n");

    assert.deepEqual(bodyMedia(body), {
      onDevice: [],
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

describe("the pictures under the device heading", () => {
  it("are listed apart with their captions, until a heading as high as theirs", () => {
    const body = [
      "## Before and after",
      "![](web/today.png)",
      `## ${DEVICE_HEADING}`,
      "![Sheet over its page](device/sheet.png)",
      "",
      "*Pixel 9, Android 16; build not verified, installed 2026-11-15T10:00:00.000Z, app 1.0*",
      "### On a tablet",
      "![](device/wide.png) iPad Air, iPadOS 26.1; build 0123456789",
      "## What changed",
      "![](web/plan.png)",
    ].join("\n");

    assert.deepEqual(bodyMedia(body), {
      onDevice: [
        {
          caption:
            "Pixel 9, Android 16; build not verified, installed 2026-11-15T10:00:00.000Z, app 1.0",
          path: "device/sheet.png",
        },
        { caption: "iPad Air, iPadOS 26.1; build 0123456789", path: "device/wide.png" },
      ],
      pictures: ["web/today.png", "web/plan.png"],
      unsupported: [],
    });
  });
});

describe("what a reader sees of the device heading (RV77)", () => {
  it("is no heading inside a comment or a code block", () => {
    const comment = `<!--\n## ${DEVICE_HEADING}\n-->\n![](device.png)\n${CAPTION}`;
    const fenced = `\`\`\`md\n## ${DEVICE_HEADING}\n\`\`\`\n![](device.png)\n${CAPTION}`;

    for (const body of [comment, fenced]) {
      assert.deepEqual(bodyMedia(body), {
        onDevice: [],
        pictures: ["device.png"],
        unsupported: [],
      });
    }
  });

  it("ends at a level-2 heading however it's written, an underlined one included", () => {
    const setext = `## ${DEVICE_HEADING}\n![](device.png)\n${CAPTION}\n\nMeasured current build\n----------------------\n![](device.png)\n${CAPTION}`;

    assert.deepEqual(bodyMedia(setext), {
      onDevice: [{ caption: CAPTION, path: "device.png" }],
      pictures: ["device.png"],
      unsupported: [],
    });
  });

  it("captions every occurrence by itself", () => {
    const repeated = `## ${DEVICE_HEADING}\n![](device.png)\n${CAPTION}\n\n![](device.png)\nMeasured from current build d41415e8c4`;

    assert.deepEqual(bodyMedia(repeated).onDevice, [
      { caption: CAPTION, path: "device.png" },
      { caption: "Measured from current build d41415e8c4", path: "device.png" },
    ]);
  });

  it("takes a caption only from visible words, never from a comment", () => {
    const hidden = `## ${DEVICE_HEADING}\n![](device.png)\n<!-- ${CAPTION} --> Current build d41415e8c4`;
    const inline = `## ${DEVICE_HEADING}\n![](device.png) <!-- ${CAPTION} --> Current build d41415e8c4`;

    assert.deepEqual(bodyMedia(hidden).onDevice, [{ caption: "", path: "device.png" }]);

    assert.deepEqual(bodyMedia(inline).onDevice, [
      { caption: "Current build d41415e8c4", path: "device.png" },
    ]);
  });

  it("fails closed on a picture under it in a table or a folded block", () => {
    const table = `## ${DEVICE_HEADING}\n\n| Sheet |\n| --- |\n| ![](device.png) |\n`;
    const folded = `## ${DEVICE_HEADING}\n\n<details>\n\n![](device.png)\n${CAPTION}\n\n</details>\n`;

    for (const body of [table, folded]) {
      const { onDevice, unsupported } = bodyMedia(body);
      assert.deepEqual(onDevice, []);
      assert.match(unsupported.join("\n"), /^device\.png: write it as a plain image line/u);
    }
  });
});
