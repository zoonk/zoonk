import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { type Capture } from "../verify/alignment-capture.mts";
import { readCaptures } from "../verify/alignment-validate.mts";
import {
  type CaptureItem,
  type Side,
  readAlignment,
  readManifest,
  writeManifest,
} from "./media.mts";
import { sha256File, sha256Text } from "./provenance.mts";

/** What `writeRender` records beside the capture: the picture and the build the test ran from. */
const PICTURE = z.object({
  build: z.object({ commit: z.string(), uncommitted: z.string() }),
  file: z.string(),
  sha256: z.string(),
});

type Render = { capture: Capture; picture: z.infer<typeof PICTURE>; source: string };

/** A render's layout file: its capture, and the picture it measured, whose bytes must match. */
async function readRender(path: string): Promise<Render> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  const { picture: record, ...rest } = z.looseObject({ picture: z.unknown() }).parse(parsed);
  const picture = PICTURE.safeParse(record).data;

  if (!picture) {
    throw new Error(
      `${path} has no picture record: render it with -Pzoonk.shots, which writes one beside each picture.`,
    );
  }

  const read = readCaptures(rest);
  const [capture] = read.kind === "captures" ? read.file.captures : [];

  if (!capture || capture.platform !== "android") {
    const problems = read.kind === "invalid" ? `:\n${read.problems}` : "";
    throw new Error(`${path} isn't an Android capture the evaluator reads${problems}`);
  }

  const source = join(dirname(path), picture.file);

  if ((await sha256File(source)) !== picture.sha256) {
    throw new Error(`${source} isn't the picture ${path} measured: render it again.`);
  }

  return { capture, picture, source };
}

function itemOf({ capture, picture }: Render, side: Side): CaptureItem {
  const { height, locale, pointer, scheme, size, width } = capture.configuration;

  return {
    build: picture.build,
    file: picture.file,
    kind: "shot",
    locale,
    name: basename(picture.file, ".png"),
    platform: "android",
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
 * Puts Android renders (each picture's `<name>.json` from `writeRender`) into a capture folder as
 * `pr:media check` reads it: the picture, its item in `capture.json` and its capture in
 * `alignment.json`. A picture adopted again replaces its earlier record.
 */
export async function adoptRenders({
  renders,
  side,
  to,
}: {
  renders: string[];
  side: Side;
  to: string;
}): Promise<CaptureItem[]> {
  const read = await Promise.all(renders.map(async (path) => readRender(path)));
  const files = new Set(read.map(({ picture }) => picture.file));

  if (files.size < read.length) {
    throw new Error("Two renders name the same picture file; adopt them into separate folders.");
  }

  await mkdir(to, { recursive: true });

  await Promise.all(
    read.map(async ({ picture, source }) => copyFile(source, join(to, picture.file))),
  );

  const items = read.map((render) => itemOf(render, side));
  const manifest = (await readManifest(to)) ?? [];
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

  return items;
}
