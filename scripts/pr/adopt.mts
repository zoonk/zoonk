import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { type Capture } from "../verify/alignment-capture.mts";
import { readCaptures } from "../verify/alignment-validate.mts";
import { carryReads } from "./carry.mts";
import {
  type CaptureItem,
  type Side,
  isRecorded,
  readAlignment,
  readManifest,
  writeManifest,
} from "./media.mts";
import { sha256File, sha256Text } from "./provenance.mts";

const APPLE_BUILD = z
  .object({ changesDigest: z.string(), commit: z.string().min(1), dirty: z.boolean() })
  .refine((build) => build.dirty || build.changesDigest === "");

const ANDROID_BUILD = z.object({ commit: z.string().min(1), uncommitted: z.string().min(1) });

const PICTURE = z.object({
  build: z.unknown(),
  file: z.string().refine((file) => file === basename(file) && file.endsWith(".png")),
  sha256: z.string(),
});

type Render = {
  capture: Capture;
  picture: {
    build: z.infer<typeof APPLE_BUILD> | z.infer<typeof ANDROID_BUILD>;
    file: string;
    sha256: string;
  };
  source: string;
};

async function readRender(path: string): Promise<Render> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  const { picture: record, ...rest } = z.looseObject({ picture: z.unknown() }).parse(parsed);
  const read = readCaptures(rest);
  const [capture] = read.kind === "captures" && read.single ? read.file.captures : [];

  if (!capture || capture.platform === "web") {
    const problems = read.kind === "invalid" ? `:\n${read.problems}` : "";
    throw new Error(`${path} isn't a native capture the evaluator reads${problems}`);
  }

  const picture = PICTURE.parse(record);
  const apple = capture.platform === "apple";
  const stamp = apple ? APPLE_BUILD : ANDROID_BUILD;
  const build = stamp.safeParse(picture.build).data;

  if (!build || (apple && !isDeepStrictEqual(build, APPLE_BUILD.safeParse(rest.build).data))) {
    throw new Error(
      `${path} has a missing, invalid or conflicting ${capture.platform} build stamp.`,
    );
  }

  const source = join(dirname(path), picture.file);

  if ((await sha256File(source)) !== picture.sha256) {
    throw new Error(`${source} isn't the picture ${path} measured: render it again.`);
  }

  return { capture, picture: { ...picture, build }, source };
}

function itemOf({ capture, picture }: Render, side: Side): CaptureItem {
  const { height, locale, pointer, scheme, size, width } = capture.configuration;

  return {
    build: picture.build,
    file: picture.file,
    kind: "shot",
    locale,
    name: basename(picture.file, ".png"),
    platform: capture.platform,
    pointer: pointer === "touch" ? "coarse" : "fine",
    scale: capture.scale,
    ...(capture.scenario && capture.scenario !== "not declared"
      ? { scenario: capture.scenario }
      : {}),
    scheme: scheme === "dark" ? "dark" : "light",
    sha256: picture.sha256,
    side,
    // The render's test names what it ran to reach the screen.
    steps: sha256Text(capture.screen),
    viewport: `${size} ${width}×${height}`,
  };
}

/**
 * Puts measured native renders into a capture folder as
 * `pr:media check` reads it: the picture, its item in `capture.json` and its capture in
 * `alignment.json`. A picture adopted again replaces its earlier record, keeping its read as a
 * capture does.
 */
export async function adoptRenders({
  renders,
  side,
  to: destination,
}: {
  renders: string[];
  side: Side;
  to?: string;
}) {
  const read = await Promise.all(renders.map(async (path) => readRender(path)));
  const platform = read[0]?.capture.platform;

  if (!platform || read.some(({ capture }) => capture.platform !== platform)) {
    throw new Error("Adopt one platform's renders at a time.");
  }

  const to = resolve(
    destination ?? join(import.meta.dirname, "../../tmp/pr-media", platform, side),
  );

  const files = new Set(read.map(({ picture }) => picture.file));

  if (files.size < read.length) {
    throw new Error("Two renders name the same picture file; adopt them into separate folders.");
  }

  await mkdir(to, { recursive: true });
  const manifest = (await readManifest(to)) ?? [];
  const previous = manifest.filter((item) => isRecorded(item));

  // Before the new pictures overwrite the old ones: a retake keeps the one it replaced.
  const carried = await Promise.all(
    [...Map.groupBy(read, ({ source }) => dirname(source))].map(async ([folder, group]) =>
      carryReads({
        folder,
        items: group.map((render) => itemOf(render, side)),
        keep: to,
        previous,
        previousFolder: to,
      }),
    ),
  );

  await Promise.all(
    read.map(async ({ picture, source }) => copyFile(source, join(to, picture.file))),
  );

  const items = carried.flat();
  await writeManifest(to, [...manifest.filter((item) => !files.has(item.file)), ...items]);

  const { captures = [] } = await readAlignment(to);

  const kept = captures.filter((capture) => !files.has(capture.picture?.file ?? ""));

  const added = read.map(({ capture, picture }) => ({
    ...capture,
    picture: { file: picture.file, sha256: picture.sha256 },
  }));

  await writeFile(
    join(to, "alignment.json"),
    `${JSON.stringify({ captures: [...kept, ...added] }, null, 2)}\n`,
  );

  return { items, platform, to };
}
