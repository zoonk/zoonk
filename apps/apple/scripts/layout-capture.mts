/**
 * Asks a Debug build running with `-ZOONK_LAYOUT_CAPTURE 1` for a capture of what's on screen,
 * and adds it to a capture folder's `alignment.json`; with `--picture`, also the picture's item in
 * its `capture.json`, bound to the build the app reports. Take the picture first, with nothing
 * moving, so both describe the same screen.
 *
 * node apps/apple/scripts/layout-capture.mts --udid <simulator> --scenario <id> --out <folder>
 *   [--screen <path or name>] [--picture <png> --side before|after]
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readCommand } from "./simulators.mts";

const BUNDLE_ID = "com.zoonk.dev";
const WAIT_MS = 15_000;
const POLL_MS = 200;

type Capture = {
  scenario: string;
  configuration: Record<string, unknown> & { size: string; width: number; height: number };
  scale: number;
  build: { commit: string; dirty?: boolean; changesDigest?: string };
  measured?: { parts: number; notMeasured: number };
};

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    picture: { type: "string" },
    scenario: { type: "string" },
    screen: { type: "string" },
    side: { type: "string" },
    udid: { type: "string" },
  },
});

const { out, picture, scenario, screen, side, udid } = values;

if (!udid || !scenario || !out || (picture && side !== "before" && side !== "after")) {
  throw new Error(
    "Usage: layout-capture.mts --udid <simulator> --scenario <id> --out <folder> [--screen <name>] [--picture <png> --side before|after]",
  );
}

async function appFolder(): Promise<string> {
  const container = readCommand({
    arguments: ["simctl", "get_app_container", udid ?? "", BUNDLE_ID, "data"],
    command: "xcrun",
  }).trim();

  const folder = path.join(container, "Documents", "layout-capture");
  await mkdir(folder, { recursive: true });
  return folder;
}

/** The app checks for a request a few times a second and writes its answer whole. */
async function answerOf(answer: string, deadline: number): Promise<Capture> {
  const written = existsSync(answer) ? await stat(answer) : null;

  if (written && written.size > 0) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The app's own capture.
    return JSON.parse(await readFile(answer, "utf8")) as Capture;
  }

  if (Date.now() > deadline) {
    throw new Error(
      "The app didn't answer. Is a Debug build running with -ZOONK_LAYOUT_CAPTURE 1, and on screen?",
    );
  }

  await new Promise((resolve) => {
    setTimeout(resolve, POLL_MS);
  });

  return answerOf(answer, deadline);
}

async function requestCapture(folder: string): Promise<Capture> {
  const answer = path.join(folder, `${scenario}.json`);
  await rm(answer, { force: true });

  await writeFile(
    path.join(folder, "request.json"),
    JSON.stringify({ scenario, screen: screen ?? scenario }),
  );

  return answerOf(answer, Date.now() + WAIT_MS);
}

async function readJson<T>(file: string, empty: T): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This script's own files.
  return existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as T) : empty;
}

const sameShot = (one: Capture, other: Capture) =>
  one.scenario === other.scenario &&
  JSON.stringify(one.configuration) === JSON.stringify(other.configuration);

const capture = await requestCapture(await appFolder());
await mkdir(out, { recursive: true });

const alignmentFile = path.join(out, "alignment.json");
const alignment = await readJson<{ captures: Capture[] }>(alignmentFile, { captures: [] });

alignment.captures = [
  ...alignment.captures.filter((existing) => !sameShot(existing, capture)),
  capture,
];

await writeFile(alignmentFile, `${JSON.stringify(alignment, null, 2)}\n`);

if (picture) {
  const manifestFile = path.join(out, "capture.json");
  const manifest = await readJson<Record<string, unknown>[]>(manifestFile, []);
  const file = path.relative(out, path.resolve(picture));
  const { configuration } = capture;

  const item = {
    build: capture.build,
    file,
    kind: "shot",
    locale: configuration.locale,
    name: scenario,
    platform: "apple",
    pointer: configuration.pointer,
    scale: capture.scale,
    scenario,
    scheme: configuration.scheme,
    sha256: createHash("sha256")
      .update(await readFile(picture))
      .digest("hex"),
    side,
    viewport: `${configuration.size} ${configuration.width}×${configuration.height}`,
  };

  await writeFile(
    manifestFile,
    `${JSON.stringify([...manifest.filter((existing) => existing.file !== file), item], null, 2)}\n`,
  );
}

const { measured } = capture;
const dirty = capture.build.dirty ? ", uncommitted changes" : "";

process.stdout.write(
  `${scenario}: ${measured?.parts ?? 0} parts measured, ${measured?.notMeasured ?? 0} not measured; build ${capture.build.commit.slice(0, 10)}${dirty}\n`,
);
