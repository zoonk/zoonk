import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Scheme, type ViewportName } from "../verify/viewports.mts";
import { type CaptureItem, pathShotName, renderMedia } from "./media.mts";

const ROOT = "tmp/pr-media";

function shot(name: string, viewport: ViewportName = "phone", scheme: Scheme = "light") {
  return {
    file: `${viewport}/${scheme}/${name}.png`,
    kind: "shot",
    name,
    scheme,
    viewport,
  } satisfies CaptureItem;
}

function video(viewport: ViewportName = "phone", scheme: Scheme = "light") {
  return {
    file: `${viewport}/${scheme}.webm`,
    kind: "video",
    scheme,
    viewport,
  } satisfies CaptureItem;
}

function linkedFiles(markdown: string): string[] {
  return [...markdown.matchAll(/\]\((?<file>[^)]+)\)/gu)].map((match) => match.groups?.file ?? "");
}

describe("naming a shot after its path", () => {
  it("keeps the path's words and drops its query", () => {
    assert.equal(pathShotName("/"), "home");
    assert.equal(pathShotName("/today"), "today");
    assert.equal(pathShotName("/learn/Course_1?tab=2#top"), "learn-course-1");
  });
});

describe("rendering the before-and-after section", () => {
  it("pairs each shot with the same shot and screen on the other side", () => {
    const { markdown } = renderMedia({
      root: ROOT,
      sides: {
        after: [shot("today"), shot("today", "laptop")],
        before: [shot("today"), shot("today", "laptop")],
      },
    });

    assert.equal(
      markdown,
      [
        "## Before and after",
        "",
        "| Screen | Before | After |",
        "| --- | --- | --- |",
        "| today · phone · light | ![Before: today · phone · light](tmp/pr-media/before/phone/light/today.png) | ![After: today · phone · light](tmp/pr-media/after/phone/light/today.png) |",
        "| today · laptop · light | ![Before: today · laptop · light](tmp/pr-media/before/laptop/light/today.png) | ![After: today · laptop · light](tmp/pr-media/after/laptop/light/today.png) |",
        "",
      ].join("\n"),
    );
  });

  it("follows the after side's order, then shots only the before side has, with a dash for a missing side", () => {
    const { markdown } = renderMedia({
      root: ROOT,
      sides: {
        after: [shot("start"), shot("dialog")],
        before: [shot("old-banner"), shot("start")],
      },
    });

    const rows = markdown.split("\n").filter((line) => line.startsWith("| ") && line.includes("·"));

    assert.deepEqual(
      rows.map((row) => row.split(" | ")[0]),
      ["| start · phone · light", "| dialog · phone · light", "| old-banner · phone · light"],
    );

    assert.match(rows[1] ?? "", /\| – \| !\[After: dialog/u);
    assert.match(rows[2] ?? "", /\.png\) \| – \|$/u);
  });

  it("puts each video alone in its paragraph, the only place GitHub plays it, before next to after", () => {
    const { markdown } = renderMedia({
      root: ROOT,
      sides: { after: [video(), video("laptop")], before: [video(), video("laptop")] },
    });

    const lines = markdown.split("\n");
    const videos = lines.flatMap((line, index) => (line.endsWith(".webm)") ? [index] : []));

    assert.deepEqual(
      videos.map((index) => lines[index]),
      [
        "![](tmp/pr-media/before/phone/light.webm)",
        "![](tmp/pr-media/after/phone/light.webm)",
        "![](tmp/pr-media/before/laptop/light.webm)",
        "![](tmp/pr-media/after/laptop/light.webm)",
      ],
    );

    for (const index of videos) {
      assert.equal(lines[index - 1], "");
      assert.equal(lines[index + 1], "");
    }
  });

  it("lists every file it links to once, so gh replaces each with its upload", () => {
    const { attachments, markdown } = renderMedia({
      root: ROOT,
      sides: { after: [shot("start"), shot("result"), video()], before: [shot("start"), video()] },
    });

    assert.deepEqual(attachments, linkedFiles(markdown));
    assert.equal(new Set(attachments).size, attachments.length);
  });
});
