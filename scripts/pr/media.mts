import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { type Scheme } from "../verify/viewports.mts";

export const SIDES = ["before", "after"] as const;
export type Side = (typeof SIDES)[number];

export const NATIVE_PLATFORMS = ["android", "apple"] as const;
export const PLATFORMS = ["web", ...NATIVE_PLATFORMS] as const;
type Platform = (typeof PLATFORMS)[number];

/**
 * What the picture shows was built from `commit` plus the uncommitted changes `changes` digests
 * (absent when the app and packages were clean). `id` is the served build's identity (a Next.js
 * build id on the web, a build stamp on Android and Apple) or "unknown" when the server wasn't
 * this checkout's current build.
 */
export type Build = { app: string; changes?: string; commit: string; id: string };

/**
 * What a native build stamps on itself: Apple's Debug build `dirty` and `changesDigest`
 * (`apps/apple/scripts/stamp-debug-build.sh`), an Android render `uncommitted`, a digest or "clean".
 */
type NativeStamp = {
  changesDigest?: string;
  commit: string;
  dirty?: boolean;
  uncommitted?: string;
};

export type FindingState =
  | { state: "open" }
  | { commit: string; state: "fixed" }
  | { grantedBy: string; state: "exception" };

export type Finding = FindingState & {
  crop?: string;
  id: string;
  measurement?: string;
  text: string;
};

/**
 * A read by someone who built none of it; no findings means the read was clean. `carriedFrom` is
 * the picture that was read, when a later capture showed the same pixels.
 */
export type Read = { at: string; by: string; carriedFrom?: string; findings: Finding[] };

/**
 * `file` is relative to its manifest's folder, with forward slashes, since Markdown links use it.
 * `steps` digests what the capture ran to reach the screen.
 */
export type CaptureItem = {
  build: Build | NativeStamp;
  /** The simulator or emulator a picture came from, as it describes itself: no capture behind it. */
  device?: string;
  /** What a device picture shows, in plain words given when it was taken. */
  shows?: string;
  file: string;
  locale: string;
  platform: Platform;
  pointer: "coarse" | "fine";
  read?: Read;
  scale: number;
  scenario?: string;
  scheme: Scheme;
  sha256: string;
  side: Side;
  steps: string;
  viewport: string;
} & ({ kind: "shot"; name: string } | { kind: "video" });

/**
 * A picture registered by hand; `file` is absolute when it lives outside the manifest's folder.
 * A native after picture stays pending until its platform's capture writes its record. An
 * existing before picture passes, since a before's build isn't checked; `source` says where it
 * came from.
 */
type RegisteredItem = { file: string; kind: CaptureItem["kind"]; sha256: string };

type PendingItem = RegisteredItem & {
  platform: (typeof NATIVE_PLATFORMS)[number];
  read?: Read;
  side: "after";
};

type RegisteredBefore = RegisteredItem & { platform: Platform; side: "before"; source: string };

export type ManifestItem = CaptureItem | PendingItem | RegisteredBefore;

export const MANIFEST = "capture.json";

/**
 * The alignment checks' report beside a capture's manifest, as far as the gate reads it: the
 * relationship lane owns its shape (unresolved means failing and not excepted).
 */
export type AlignmentReport = {
  captures?: { elements?: unknown[]; picture?: { file?: string } }[];
  findings?: { exception?: string; level: string; message: string }[];
  summary?: { notMeasured?: number; scenariosMissing?: number | null; unresolved?: number };
};

const SIDE_LABEL: Record<Side, string> = { after: "After", before: "Before" };

/** Lowercase letters and digits joined by hyphens: safe as a file name and inside a Markdown link. */
export function fileName(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

export function pathWithin(from: string, path: string): string {
  const inside = relative(from, path);
  const shown = inside.startsWith("..") || isAbsolute(inside) ? path : inside || ".";
  return shown.replaceAll("\\", "/");
}

export function displayPath(path: string): string {
  return pathWithin(process.cwd(), path);
}

export function pathShotName(path: string): string {
  return fileName(new URL(path, "http://localhost").pathname) || "home";
}

async function readJson<T>(path: string): Promise<T | undefined> {
  if (!existsSync(path)) {
    return undefined;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- These scripts' own files.
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function readManifest(folder: string): Promise<ManifestItem[] | undefined> {
  return readJson<ManifestItem[]>(join(folder, MANIFEST));
}

export async function readCapture(folder: string): Promise<CaptureItem[] | undefined> {
  const items = await readManifest(folder);
  return items?.filter((item) => isRecorded(item));
}

export async function readAlignment(folder: string): Promise<AlignmentReport> {
  return (await readJson<AlignmentReport>(join(folder, "alignment.json"))) ?? {};
}

export async function writeManifest(folder: string, items: ManifestItem[]): Promise<void> {
  await writeFile(join(folder, MANIFEST), `${JSON.stringify(items, null, 2)}\n`);
}

/**
 * A picture registered again with the same bytes keeps its record, read and findings included,
 * and a capture's record is never replaced by one made by hand.
 */
export async function registerItems(folder: string, added: ManifestItem[]): Promise<void> {
  const existing = (await readManifest(folder)) ?? [];
  const byFile = new Map(existing.map((item) => [item.file, item]));

  const replacing = added.filter((item) => {
    const earlier = byFile.get(item.file);
    return !earlier || (earlier.sha256 !== item.sha256 && !isRecorded(earlier));
  });

  const files = new Set(replacing.map((item) => item.file));
  await writeManifest(folder, [...existing.filter((item) => !files.has(item.file)), ...replacing]);
}

/** A read counts only with the name of whoever read. */
export function readOf(item: ManifestItem): Read | undefined {
  const read = "read" in item ? item.read : undefined;
  return read?.by.trim() ? read : undefined;
}

/**
 * Every platform's build in one shape. A native stamp names its app by its platform, and a build
 * not stamped clean counts as built with changes.
 */
export function buildOf({ build, platform }: CaptureItem): Build {
  if ("id" in build) {
    return build;
  }

  const { changesDigest, commit, dirty, uncommitted } = build;
  const clean = uncommitted === undefined ? dirty === false : uncommitted === "clean";
  const digest = changesDigest || (uncommitted !== "unknown" && uncommitted) || "uncommitted";

  return {
    app: platform,
    changes: clean ? undefined : digest,
    commit,
    id: commit === "unknown" ? "unknown" : commit,
  };
}

/**
 * What was verified about a device picture: its device, and the installed build's commit, or, for
 * an emulator's app, which carries none, that the build wasn't verified and when it was installed.
 */
export function deviceLine(item: CaptureItem): string {
  const { commit, id } = buildOf(item);
  const build = commit === "unknown" ? `build not verified, ${id}` : `build ${commit.slice(0, 10)}`;
  return `${item.device}; ${build}`;
}

export function isRecorded(item: ManifestItem): item is CaptureItem {
  return "build" in item;
}

export type Sides = Partial<Record<Side, CaptureItem[]>>;

type Pair = Partial<Record<Side, CaptureItem>> & { name: string; row: string; screen: string };

function screenOf(item: CaptureItem): string {
  return `${item.viewport} · ${item.scheme}`;
}

function rowOf(item: CaptureItem): string {
  return item.kind === "shot" ? `${item.name} · ${screenOf(item)}` : screenOf(item);
}

export function pairItems(sides: Sides, kind: CaptureItem["kind"]): Pair[] {
  const pairs = new Map<string, Pair>();

  for (const side of ["after", "before"] as const) {
    for (const item of sides[side] ?? []) {
      if (item.kind === kind) {
        const row = rowOf(item);
        const name = item.kind === "shot" ? item.name : "Video";
        pairs.set(row, { name, row, screen: screenOf(item), ...pairs.get(row), [side]: item });
      }
    }
  }

  return [...pairs.values()];
}

/** Each video stands alone in its paragraph: GitHub plays a video only there. */
export function renderMedia({
  root,
  sides,
  unchanged = new Set(),
}: {
  root: string;
  sides: Sides;
  unchanged?: ReadonlySet<string>;
}): { attachments: string[]; markdown: string } {
  const link = (side: Side, item: CaptureItem) => `${root}/${side}/${item.file}`;
  const shots = pairItems(sides, "shot").filter((pair) => !unchanged.has(pair.row));
  const videos = pairItems(sides, "video");

  const image = (side: Side, pair: Pair) => {
    const item = pair[side];
    return item ? `![${SIDE_LABEL[side]}: ${pair.row}](${link(side, item)})` : "–";
  };

  const screenPanels = [...Map.groupBy(shots, (pair) => pair.name)].map(([name, pairs]) => ({
    body: [
      "| | Before | After |",
      "| --- | --- | --- |",
      ...pairs.map(
        (pair) => `| ${pair.screen} | ${image("before", pair)} | ${image("after", pair)} |`,
      ),
      "",
    ],
    summary: name,
  }));

  const videoPanels = videos.map((pair) => ({
    body: SIDES.flatMap((side) => {
      const item = pair[side];
      return item ? [`**${SIDE_LABEL[side]}**`, "", `![](${link(side, item)})`, ""] : [];
    }),
    summary: `${pair.name} · ${pair.screen}`,
  }));

  const panels = [...screenPanels, ...videoPanels].flatMap(({ body, summary }, index) => [
    index === 0 ? "<details open>" : "<details>",
    `<summary>${summary}</summary>`,
    "",
    ...body,
    "</details>",
    "",
  ]);

  const attachments = [...shots, ...videos].flatMap((pair) =>
    SIDES.flatMap((side) => {
      const item = pair[side];
      return item ? [link(side, item)] : [];
    }),
  );

  return { attachments, markdown: ["## Before and after", "", ...panels].join("\n") };
}
