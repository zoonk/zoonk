import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, it } from "vitest";
import { carryReads } from "./carry.mts";
import { type CaptureItem, type Read } from "./media.mts";

const SIZE = 40;

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Where a retake keeps the picture it replaced. */
const RETAKEN = "earlier/phone/light/today.png";

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

  // The picture an earlier retake kept, read before the one now in the folder.
  mkdirSync(join(previousFolder, "earlier/phone/light"), { recursive: true });
  writeFileSync(join(previousFolder, RETAKEN), await png({ left: 2 }));

  const [carried] = await carryReads({
    folder,
    items: [item(now)],
    previous: [item({ read: READ, sha256: sha256(await png()), ...before })],
    previousFolder,
  });

  return { carried, folder, read: carried?.read };
}

describe("a re-capture keeps the read of pictures whose pixels didn't change", () => {
  it("asks for a read when the picture read was overwritten in place, keeping its findings", async () => {
    const folder = mkdtempSync(join(tmpdir(), "pr-media-carry-"));
    mkdirSync(join(folder, "phone/light"), { recursive: true });
    const moved = await png({ left: 11 });
    writeFileSync(join(folder, "phone/light/today.png"), moved);

    const [carried] = await carryReads({
      folder,
      items: [item({ sha256: sha256(moved) })],
      previous: [item({ read: READ, sha256: sha256(await png()) })],
      previousFolder: folder,
    });

    assert.equal(carried?.read, undefined);
    assert.deepEqual(carried?.retakes, { read: READ });
  });

  it("carries the read and its findings' states to the same pixels in different bytes", async () => {
    const { read } = await recapture({ picture: await png({ effort: 1 }) });

    assert.deepEqual(read, { ...READ, carriedFrom: sha256(await png()) });
  });

  it("asks for a read of the fixes when the picture moved by one pixel, keeping the one it retakes", async () => {
    const { carried, folder } = await recapture({ picture: await png({ left: 11 }) });

    assert.equal(carried?.read, undefined);
    assert.deepEqual(carried?.retakes, { file: RETAKEN, read: READ, sha256: sha256(await png()) });
    assert.deepEqual(readFileSync(join(folder, RETAKEN)), await png());
  });

  it("keeps what an unread retake retook when it is captured again", async () => {
    const { carried, folder } = await recapture({
      before: { read: undefined, retakes: { file: RETAKEN, read: READ } },
      picture: await png({ left: 12 }),
    });

    assert.deepEqual(carried?.retakes, {
      file: RETAKEN,
      read: READ,
      sha256: sha256(await png({ left: 2 })),
    });

    assert.deepEqual(readFileSync(join(folder, RETAKEN)), await png({ left: 2 }));
  });

  it("carries the read when a retake returns to the pixels last read", async () => {
    const earlier = await png({ left: 2 });

    const { read } = await recapture({
      before: { read: undefined, retakes: { file: RETAKEN, read: READ } },
      now: { sha256: sha256(earlier) },
      picture: earlier,
    });

    assert.deepEqual(read, { ...READ, carriedFrom: sha256(earlier) });
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

    const retakes = await Promise.all(changes.map(async (now) => recapture({ now, picture })));

    assert.ok(retakes.every(({ carried }) => !carried?.read && !carried?.retakes));
  });
});
