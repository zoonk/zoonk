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
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readCommand } from "./simulators.mts";

const BUNDLE_ID = "com.zoonk.dev";
const WAIT_MS = 15_000;
const POLL_MS = 200;

export type Capture = {
  scenario: string;
  screen: string;
  side?: string;
  configuration: Record<string, unknown> & { size: string; width: number; height: number };
  scale: number;
  build: { commit: string; dirty?: boolean; changesDigest?: string };
  picture: { file: string; sha256: string; pixels?: number[] };
  measured?: { parts: number; notMeasured: number };
  error?: string;
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

async function requestCapture(folder: string, scenario: string, screen: string): Promise<Capture> {
  const answer = path.join(folder, `${scenario}.json`);
  await rm(answer, { force: true });
  await rm(path.join(folder, `${scenario}.png`), { force: true });
  await writeFile(path.join(folder, "request.json"), JSON.stringify({ scenario, screen }));

  return answerOf(answer, Date.now() + WAIT_MS);
}

async function readJson<T>(file: string, empty: T): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This script's own files.
  return existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as T) : empty;
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
  const answer = await requestCapture(folder, scenario, values.screen ?? scenario);

  if (answer.error) {
    throw new Error(`The app couldn't capture the screen: ${answer.error}`);
  }

  // The picture is the app's own drawing of the frame it measured; its hash proves it is that one.
  const file = `${scenario}.${side}.png`;
  await mkdir(out, { recursive: true });
  await copyFile(path.join(folder, answer.picture.file), path.join(out, file));

  if ((await sha256(path.join(out, file))) !== answer.picture.sha256) {
    throw new Error(`${file} isn't the frame the capture measured; capture it again.`);
  }

  const capture: Capture = { ...answer, picture: { ...answer.picture, file }, side };
  const alignmentFile = path.join(out, "alignment.json");
  const alignment = await readJson<{ captures: Capture[] }>(alignmentFile, { captures: [] });
  alignment.captures = mergeCapture(alignment.captures, capture);
  await writeFile(alignmentFile, `${JSON.stringify(alignment, null, 2)}\n`);

  const manifestFile = path.join(out, "capture.json");
  const manifest = await readJson<Record<string, unknown>[]>(manifestFile, []);
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

  const { measured } = capture;
  const dirty = capture.build.dirty ? ", uncommitted changes" : "";

  process.stdout.write(
    `${scenario} (${side}): ${measured?.parts ?? 0} parts measured, ${measured?.notMeasured ?? 0} not measured; build ${capture.build.commit.slice(0, 10)}${dirty}\n`,
  );
}

if (import.meta.main) {
  await main();
}
