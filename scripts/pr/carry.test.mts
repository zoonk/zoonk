import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, it } from "vitest";
import { carryReads } from "./carry.mts";
import { type CaptureItem, type Read } from "./media.mts";

const SIZE = 40;

const READ: Read = {
  at: "2026-11-14T12:00:00.000Z",
  by: "reader",
  findings: [{ grantedBy: "the user", id: "f1", state: "exception", text: "the day bar is 40 px" }],
};

/** A white picture with a black bar at `left`; `effort` changes the bytes, never the pixels. */
async function png({ effort = 7, left = 10 }: { effort?: number; left?: number } = {}) {
  return sharp({ create: { background: "#fff", channels: 4, height: SIZE, width: SIZE } })
    .composite([
      {
        input: { create: { background: "#000", channels: 4, height: 4, width: 12 } },
        left,
        top: 8,
      },
    ])
    .png({ effort })
    .toBuffer();
}

function item(overrides: Partial<CaptureItem> = {}): CaptureItem {
  return {
    build: { app: "main", commit: "c0ffee", id: "build" },
    file: "phone/light/today.png",
    kind: "shot",
    locale: "en",
    name: "today",
    platform: "web",
    pointer: "coarse",
    scale: 3,
    scheme: "light",
    sha256: "new",
    side: "after",
    steps: "steps",
    viewport: "phone",
    ...overrides,
  };
}

async function recapture({
  before = {},
  now = {},
  picture,
}: {
  before?: Partial<CaptureItem>;
  now?: Partial<CaptureItem>;
  picture: Buffer;
}) {
  const root = mkdtempSync(join(tmpdir(), "pr-media-carry-"));
  const previousFolder = join(root, "after");
  const folder = join(root, "after.partial");

  for (const [base, bytes] of [
    [previousFolder, await png()],
    [folder, picture],
  ] as const) {
    mkdirSync(join(base, "phone/light"), { recursive: true });
    writeFileSync(join(base, "phone/light/today.png"), bytes);
  }

  const [carried] = await carryReads({
    folder,
    items: [item(now)],
    previous: [item({ read: READ, sha256: "old", ...before })],
    previousFolder,
  });

  return carried?.read;
}

describe("a re-capture keeps the read of pictures whose pixels didn't change", () => {
  it("carries the read and its findings' states to the same pixels in different bytes", async () => {
    const read = await recapture({ picture: await png({ effort: 1 }) });

    assert.deepEqual(read, { ...READ, carriedFrom: "old" });
  });

  it("asks for a new read when the picture moved by one pixel", async () => {
    assert.equal(await recapture({ picture: await png({ left: 11 }) }), undefined);
  });

  it("never carries a read across a changed scenario, viewport, locale, scheme or scale", async () => {
    const picture = await png();

    const changes: Partial<CaptureItem>[] = [
      { scenario: "session.lesson-wait.failed" },
      { viewport: "laptop" },
      { locale: "de" },
      { scheme: "dark" },
      { scale: 2 },
    ];

    const reads = await Promise.all(changes.map(async (now) => recapture({ now, picture })));

    assert.ok(reads.every((read) => read === undefined));
  });
});
