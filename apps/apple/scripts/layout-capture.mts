/**
 * Asks a Debug build running with `-ZOONK_LAYOUT_CAPTURE 1` for a capture of what's on screen. The
 * app draws its window once, measures that frame and returns it as the picture, so the picture and
 * the capture are one frame of one build. Adds the capture to a capture folder's `alignment.json`
 * and the picture's item to its `capture.json`.
 *
 * node apps/apple/scripts/layout-capture.mts --udid <simulator> --scenario <id> --side before|after
 *   --out <folder> [--screen <path or name>]
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readCommand } from "./simulators.mts";

const BUNDLE_ID = "com.zoonk.dev";
const WAIT_MS = 15_000;
const POLL_MS = 200;

export type Capture = {
  version: 1;
  platform: "apple";
  unit: "pt";
  elements: unknown[];
  scenario: string;
  screen: string;
  side?: string;
  configuration: Record<string, unknown> & { size: string; width: number; height: number };
  scale: number;
  build: { commit: string; dirty?: boolean; changesDigest?: string };
  picture: { file: string; sha256: string; pixels?: number[] };
  measured?: { parts: number; notMeasured: number };
};

/**
 * One capture per picture. Capturing the same shot again (scenario, side, screen and configuration)
 * replaces it; a capture that would take another shot's picture file is refused, so no picture is
 * left described by another frame's measurement.
 */
export function mergeCapture(captures: Capture[], capture: Capture): Capture[] {
  const same = captures.find((existing) => existing.picture.file === capture.picture.file);

  if (
    same &&
    (same.screen !== capture.screen ||
      JSON.stringify(same.configuration) !== JSON.stringify(capture.configuration))
  ) {
    throw new Error(
      `${capture.picture.file} already holds another screen or configuration (${same.screen}); give this one another --scenario or --out.`,
    );
  }

  return [...captures.filter((existing) => existing !== same), capture];
}

async function appFolder(udid: string): Promise<string> {
  const container = readCommand({
    arguments: ["simctl", "get_app_container", udid, BUNDLE_ID, "data"],
    command: "xcrun",
  }).trim();

  const folder = path.join(container, "Documents", "layout-capture");
  await mkdir(folder, { recursive: true });
  return folder;
}

/** The app checks for a request a few times a second and writes its answer whole. */
async function answerOf(answer: string, deadline: number): Promise<unknown> {
  const written = existsSync(answer) ? await stat(answer) : null;

  if (written && written.size > 0) {
    return JSON.parse(await readFile(answer, "utf8"));
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

async function requestCapture(folder: string, scenario: string, screen: string): Promise<unknown> {
  const answer = path.join(folder, `${scenario}.json`);
  await rm(answer, { force: true });
  await rm(path.join(folder, `${scenario}.png`), { force: true });
  await writeFile(path.join(folder, "request.json"), JSON.stringify({ scenario, screen }));

  return answerOf(answer, Date.now() + WAIT_MS);
}

const sha256 = async (file: string) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: "string" },
      scenario: { type: "string" },
      screen: { type: "string" },
      side: { type: "string" },
      udid: { type: "string" },
    },
  });

  const { out, scenario, side, udid } = values;

  if (!udid || !scenario || !out || (side !== "before" && side !== "after")) {
    throw new Error(
      "Usage: layout-capture.mts --udid <simulator> --scenario <id> --side before|after --out <folder> [--screen <name>]",
    );
  }

  const folder = await appFolder(udid);
  const answered = await requestCapture(folder, scenario, values.screen ?? scenario);

  if (isRecord(answered) && typeof answered.error === "string") {
    throw new Error(`The app couldn't capture the screen: ${answered.error}`);
  }

  const answer = parseCapture(answered);

  const capture = await saveCapture({
    answer,
    out,
    picture: path.join(folder, answer.picture.file),
    scenario,
    side,
  });

  const { measured } = capture;
  const dirty = capture.build.dirty ? ", uncommitted changes" : "";

  process.stdout.write(
    `${scenario} (${side}): ${measured?.parts ?? 0} parts measured, ${measured?.notMeasured ?? 0} not measured; build ${capture.build.commit.slice(0, 10)}${dirty}\n`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** What the app answered, checked before anything counts it or lands in a capture folder. */
const missing = (what: string) => new Error(`The app's answer isn't a capture: ${what}.`);

export function parseCapture(value: unknown): Capture {
  if (!isRecord(value)) {
    throw missing("not an object");
  }

  const { build, configuration, elements, picture, platform, scale, scenario, screen } = value;

  if (value.version !== 1 || platform !== "apple" || value.unit !== "pt") {
    throw missing("its version, platform or unit isn't 1, apple and pt");
  }

  if (!Array.isArray(elements) || typeof scenario !== "string" || typeof screen !== "string") {
    throw missing("no elements, scenario or screen");
  }

  if (
    !isRecord(configuration) ||
    typeof configuration.size !== "string" ||
    typeof configuration.width !== "number" ||
    typeof configuration.height !== "number" ||
    typeof scale !== "number"
  ) {
    throw missing("no configuration or scale");
  }

  if (
    !isRecord(build) ||
    typeof build.commit !== "string" ||
    !isRecord(picture) ||
    typeof picture.file !== "string" ||
    typeof picture.sha256 !== "string"
  ) {
    throw missing("no build or picture");
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Its fields are checked above.
  return value as Capture;
}

/** A capture folder's file, or `empty` when there's none; one that isn't its shape is refused. */
async function readFolderFile<T>(file: string, empty: T, isShape: (value: unknown) => boolean) {
  if (!existsSync(file)) {
    return empty;
  }

  const value: unknown = JSON.parse(await readFile(file, "utf8"));

  if (!isShape(value)) {
    throw new Error(`${file} isn't a capture folder's; move it aside or pick another --out.`);
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Its shape is checked above.
  return value as T;
}

/**
 * Adds the app's answer and its picture to a capture folder. Everything is checked first (the
 * answer, the folder's files, the merge, the picture's hash on a staged copy); only then is the
 * picture moved in and the files written, so a refused capture leaves the folder as it was.
 */
export async function saveCapture({
  answer,
  out,
  picture,
  scenario,
  side,
}: {
  answer: unknown;
  out: string;
  picture: string;
  scenario: string;
  side: string;
}): Promise<Capture> {
  const checked = parseCapture(answer);
  const file = `${scenario}.${side}.png`;
  const capture: Capture = { ...checked, picture: { ...checked.picture, file }, side };

  const alignmentFile = path.join(out, "alignment.json");
  const manifestFile = path.join(out, "capture.json");

  const alignment = await readFolderFile<{ captures: Capture[] }>(
    alignmentFile,
    { captures: [] },
    (value) => isRecord(value) && Array.isArray(value.captures),
  );

  const manifest = await readFolderFile<Record<string, unknown>[]>(manifestFile, [], (value) =>
    Array.isArray(value),
  );

  alignment.captures = mergeCapture(alignment.captures, capture);
  await mkdir(out, { recursive: true });

  // The picture is the app's own drawing of the frame it measured; its hash proves it is that one.
  const staged = path.join(out, `.${file}.staged`);

  try {
    await copyFile(picture, staged);

    if ((await sha256(staged)) !== checked.picture.sha256) {
      throw new Error(`${file} isn't the frame the capture measured; capture it again.`);
    }

    await rename(staged, path.join(out, file));
  } finally {
    await rm(staged, { force: true });
  }

  await writeFile(alignmentFile, `${JSON.stringify(alignment, null, 2)}\n`);

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
    screen: capture.screen,
    sha256: capture.picture.sha256,
    side,
    viewport: `${configuration.size} ${configuration.width}×${configuration.height}`,
  };

  await writeFile(
    manifestFile,
    `${JSON.stringify([...manifest.filter((existing) => existing.file !== file), item], null, 2)}\n`,
  );

  return capture;
}

if (import.meta.main) {
  await main();
}
