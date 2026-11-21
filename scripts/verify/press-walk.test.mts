import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { type Page } from "@playwright/test";
import { test, vi } from "vitest";
import {
  type Frame,
  type TextLine,
  readFrame,
  readRegions,
  readTextLines,
} from "./press-probe.mts";
import { pressSection } from "./press-report.mts";
import { pressWalk } from "./press-walk.mts";
import { type Action, type Comparison } from "./states-probe.mts";

const AT_REST: Frame = { scrollbar: 0, sideways: 0 };
const CONTROL = { height: 36, left: 10, top: 10, width: 100 };
const RESTORED: Comparison = { moved: [], target: CONTROL };

const OUTER: Action = {
  id: "outer",
  kind: "overlay",
  label: "Options",
  name: "Options",
  role: "button",
};

const INNER: Action = { id: "inner", kind: "pick", label: "Yearly", name: "Yearly", role: "radio" };

const TITLE: TextLine = {
  bottom: 40,
  element: 1,
  layer: null,
  left: 0,
  name: "Title",
  overlay: false,
  right: 200,
  top: 0,
  within: [],
};

function pageFixture({
  frame,
  lines = [],
  screenshot,
}: {
  frame: Frame;
  lines?: TextLine[];
  screenshot: (path: string) => Promise<void>;
}) {
  const probes = new Map<unknown, unknown>([
    [readFrame, frame],
    [readRegions, { appeared: [], gone: [] }],
    [readTextLines, lines],
  ]);

  const page = {
    evaluate(probe: unknown) {
      return probes.get(probe);
    },
    frames: () => [],
    async screenshot({ path }: { path: string }) {
      await screenshot(path);
    },
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The browser stub only implements the Page methods the walk and its screenshots use.
  return page as unknown as Page;
}

function report(walk: ReturnType<typeof pressWalk>, folder: string) {
  const load = {
    path: "/fixture",
    pressRecords: walk.records,
    viewport: "phone" as const,
    walk: { actionsSkipped: 0, actionsTried: 0, panelsOpened: 0, presses: walk.coverage },
  };

  return pressSection([load], folder).join("\n");
}

test("reports failed pictures and keeps the before shots paired with their own presses", async () => {
  const folder = await mkdtemp(join(tmpdir(), "press-walk-"));

  try {
    const errors = new Map([
      ["01-overlap.png", "Overlap capture timed out"],
      ["03-after.png", "After capture timed out"],
      ["02-before.png", "Before capture timed out"],
    ]);

    const page = pageFixture({
      frame: { ...AT_REST, sideways: 20 },
      lines: [TITLE, { ...TITLE, element: 2, name: "Subtitle" }],
      async screenshot(path) {
        const error = errors.get(basename(path));

        if (error) {
          throw new Error(error);
        }

        await writeFile(path, "");
      },
    });

    const reload = vi.fn<() => Promise<void>>().mockResolvedValue();
    const walk = pressWalk(page, { folder, reload });

    await walk.overlaps("at rest", "");
    await walk.begin(OUTER);

    await walk.pressed(OUTER, {
      before: AT_REST,
      comparison: RESTORED,
      doing: "opening",
      sent: false,
    });

    await walk.begin(INNER);

    await walk.pressed(INNER, {
      before: AT_REST,
      comparison: RESTORED,
      doing: "picking",
      sent: false,
    });

    await walk.undone(RESTORED);
    await walk.undone(RESTORED);

    assert.deepEqual(
      walk.records.map((record) => record.control),
      ["at rest", 'picking radio "Yearly"', 'opening button "Options"'],
    );

    assert.equal(walk.findings.length, 3);
    const files = await readdir(folder);
    assert.deepEqual(files.toSorted(), ["02-after.png", "03-before.png"]);
    assert.equal(reload.mock.calls.length, 0);

    assert.deepEqual(
      walk.records.map((record) => record.pictures),
      [
        [{ error: "Overlap capture timed out", name: "overlap" }],
        [
          { file: join(folder, "03-before.png"), name: "before" },
          { error: "After capture timed out", name: "after" },
        ],
        [
          { error: "Before capture timed out", name: "before" },
          { file: join(folder, "02-after.png"), name: "after" },
        ],
      ],
    );

    const rendered = report(walk, folder);
    assert.match(rendered, /Title and Subtitle are drawn over each other/u);
    assert.match(rendered, /Overlap capture timed out/u);
    assert.match(rendered, /After capture timed out/u);
    assert.match(rendered, /Before capture timed out/u);
    assert.match(rendered, /03-before\.png/u);
    assert.match(rendered, /02-after\.png/u);
    assert.doesNotMatch(rendered, /01-overlap\.png|03-after\.png|02-before\.png/u);
  } finally {
    await rm(folder, { force: true, recursive: true });
  }
});

test("reports a press whose fault only appears after undo", async () => {
  const screenshot = vi.fn<() => Promise<void>>().mockResolvedValue();
  const reload = vi.fn<() => Promise<void>>().mockResolvedValue();

  const page = pageFixture({ frame: AT_REST, screenshot });

  const walk = pressWalk(page, { folder: tmpdir(), reload });

  const moved = {
    after: { ...CONTROL, left: 30 },
    anchor: false,
    before: CONTROL,
    carried: false,
    drawn: false,
    holds: false,
    inside: false,
    isTarget: true,
    label: INNER.label,
    reworded: false,
  };

  await walk.begin(INNER);

  await walk.pressed(INNER, {
    before: AT_REST,
    comparison: RESTORED,
    doing: "picking",
    sent: false,
  });

  await walk.undone({ ...RESTORED, moved: [moved] });

  assert.equal(screenshot.mock.calls.length, 0);
  assert.equal(reload.mock.calls.length, 1);
  assert.match(report(walk, tmpdir()), /undoing picking radio "Yearly": Yearly moved 20 px right/u);
});
