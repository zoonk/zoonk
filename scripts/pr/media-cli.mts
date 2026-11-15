/* oxlint-disable no-console -- This CLI prints what the check found and what to do next. */
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { adoptRenders } from "./adopt.mts";
import { checkPictures } from "./check.mts";
import { DEVICE_BRIDGES, takeDevicePicture } from "./device.mts";
import { bodyMedia, findManifests, isRemote, manifestsAbove } from "./locate.mts";
import { USAGE } from "./media-usage.mts";
import {
  type Finding,
  type FindingState,
  MANIFEST,
  NATIVE_PLATFORMS,
  PLATFORMS,
  SIDES,
  displayPath,
  pathWithin,
  readManifest,
  readOf,
  registerItems,
  writeManifest,
} from "./media.mts";
import { resolveCommit, sha256File } from "./provenance.mts";
import { type ReadFinding, parseFindings, recordReads } from "./read.mts";
import { formatCheck } from "./report.mts";
import { writeSection } from "./section.mts";
import { writeReadingSheet } from "./tiles.mts";

const repository = resolve(import.meta.dirname, "../..");
const CAPTURE = join(repository, "tmp/pr-media");
const REGISTERED = join(CAPTURE, "registered");

function readArguments() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        by: { type: "string" },
        device: { type: "string" },
        exception: { type: "string" },
        findings: { type: "string" },
        fixed: { type: "string" },
        help: { default: false, short: "h", type: "boolean" },
        manifests: { default: [], multiple: true, type: "string" },
        name: { type: "string" },
        platform: { type: "string" },
        root: { type: "string" },
        source: { type: "string" },
        to: { type: "string" },
      },
    });
  } catch (error) {
    throw new Error(`${String(error)}\n\n${USAGE}`, { cause: error });
  }
}

type Arguments = ReturnType<typeof readArguments>;

function fail(message: string): never {
  throw new Error(`${message}\n\n${USAGE}`);
}

async function check({ positionals: [body], values }: Arguments) {
  if (!body) {
    fail("Name the PR body file to check.");
  }

  const root = resolve(values.root ?? dirname(body));
  const markdown = await readFile(body, "utf8");

  const media = bodyMedia(markdown);
  const pictures = media.pictures.map((link) => (isRemote(link) ? link : resolve(root, link)));

  const named = await Promise.all(
    values.manifests.map(async (folder) => findManifests(resolve(folder))),
  );

  const manifests = [...manifestsAbove(pictures), ...named.flat()];

  const result = await checkPictures({
    manifests,
    pictures,
    repository,
    unsupported: media.unsupported,
  });

  console.log(formatCheck(result, root));
  return result.problems.length === 0;
}

async function refreshSection(root: string): Promise<boolean> {
  if (!SIDES.some((side) => existsSync(join(root, side, MANIFEST)))) {
    return true;
  }

  const { report, written } = await writeSection({ out: root, repository });
  console.log(report);
  return written;
}

async function readFindingsFile(path: string | undefined): Promise<ReadFinding[]> {
  if (!path) {
    return [];
  }

  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));

  return (
    parseFindings(parsed) ??
    fail(
      `${path} must be a JSON array of { "file", "text" }, where "file" may list several pictures and "measurement" and "crop" are optional.`,
    )
  );
}

async function recordRead({ positionals: [folder], values }: Arguments) {
  const by = values.by ?? "";
  const root = resolve(folder ?? CAPTURE);
  const entries = await readFindingsFile(values.findings);

  const { already, read } = await recordReads({ by, entries, root }).catch((error: unknown) =>
    fail(error instanceof Error ? error.message : String(error)),
  );

  console.log(
    `Recorded ${by.trim()}'s read of ${read} pictures (${already} already read), ${entries.length} findings.`,
  );

  return refreshSection(root);
}

async function resolutionOf(values: Arguments["values"]): Promise<FindingState> {
  if (Boolean(values.fixed) === Boolean(values.exception)) {
    fail("Give --fixed <commit> or --exception <who granted it>, not both.");
  }

  return values.fixed
    ? { commit: await resolveCommit({ repository, revision: values.fixed }), state: "fixed" }
    : { grantedBy: values.exception ?? "", state: "exception" };
}

function resolveIn(findings: Finding[], id: string, state: FindingState): Finding[] {
  return findings.map((finding) => (finding.id === id ? { ...finding, ...state } : finding));
}

async function resolveFinding({ positionals: [id, folder], values }: Arguments) {
  if (!id) {
    fail("Name the finding to resolve.");
  }

  const state = await resolutionOf(values);
  const root = resolve(folder ?? CAPTURE);
  const folders = await findManifests(root);

  const changed = await Promise.all(
    folders.map(async (manifest) => {
      const items = (await readManifest(manifest)) ?? [];

      const found = items.some((item) =>
        readOf(item)?.findings.some((finding) => finding.id === id),
      );

      if (found) {
        await writeManifest(
          manifest,
          items.map((item) => {
            const read = readOf(item);

            return read
              ? { ...item, read: { ...read, findings: resolveIn(read.findings, id, state) } }
              : item;
          }),
        );
      }

      return found;
    }),
  );

  if (!changed.includes(true)) {
    fail(`No finding ${id} under ${root}.`);
  }

  console.log(`${id}: ${state.state}`);
  return refreshSection(root);
}

const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".webm"]);

async function hashPictures(files: string[], to: string) {
  return Promise.all(
    files.map(async (file) => ({
      file: pathWithin(to, resolve(file)),
      kind: VIDEO_EXTENSIONS.has(extname(file)) ? ("video" as const) : ("shot" as const),
      sha256: await sha256File(file),
    })),
  );
}

/** A capture that recorded these bytes as an after holds them to an after's bar. */
async function capturedAsAfter(files: string[], to: string): Promise<string[]> {
  const pictures = files.map((file) => resolve(file));
  const searched = await Promise.all([findManifests(CAPTURE), findManifests(to)]);
  const folders = [...new Set([...manifestsAbove(pictures), ...searched.flat()])];

  const items = await Promise.all(
    folders.map(async (folder) => (await readManifest(folder)) ?? []),
  );

  const afters = new Set(
    items.flat().flatMap((item) => (item.side === "after" ? [item.sha256] : [])),
  );

  const hashes = await Promise.all(pictures.map(async (picture) => sha256File(picture)));
  return pictures.filter((_, index) => afters.has(hashes[index] ?? ""));
}

async function recordPending({ positionals: files, values }: Arguments) {
  const platform = NATIVE_PLATFORMS.find((name) => name === values.platform);

  if (!platform || files.length === 0) {
    fail("Give --platform android or apple, and the after pictures.");
  }

  const to = resolve(values.to ?? REGISTERED);
  await mkdir(to, { recursive: true });
  const pictures = await hashPictures(files, to);

  await registerItems(
    to,
    pictures.map((picture) => ({ ...picture, platform, side: "after" as const })),
  );

  console.log(
    `${files.length} ${platform} pictures pending in ${displayPath(join(to, MANIFEST))}.`,
  );

  return true;
}

async function recordBefore({ positionals: files, values }: Arguments) {
  const platform = PLATFORMS.find((name) => name === values.platform);
  const source = values.source ?? "";

  if (!platform || !source || files.length === 0) {
    fail(
      "Give --platform web, android or apple, --source <where they came from>, and the before pictures.",
    );
  }

  const to = resolve(values.to ?? REGISTERED);
  const afters = await capturedAsAfter(files, to);

  if (afters.length > 0) {
    fail(
      `A capture already records these as after pictures, so they can't be registered as before pictures: ${afters.map((file) => displayPath(file)).join(", ")}`,
    );
  }

  await mkdir(to, { recursive: true });
  const pictures = await hashPictures(files, to);

  await registerItems(
    to,
    pictures.map((picture) => ({ ...picture, platform, side: "before" as const, source })),
  );

  console.log(
    `${files.length} ${platform} before pictures registered in ${displayPath(join(to, MANIFEST))}.`,
  );

  return true;
}

async function adopt({ positionals: [sideName, ...renders], values }: Arguments) {
  const side = SIDES.find((name) => name === sideName);

  if (!side || renders.length === 0) {
    fail("Name a side, before or after, then the renders' <name>.json files.");
  }

  const to = resolve(values.to ?? join(CAPTURE, "android", side));
  const items = await adoptRenders({ renders, side, to });

  console.log(
    `${items.length} Android ${side} pictures in ${displayPath(join(to, MANIFEST))}, their layout in alignment.json.`,
  );

  return true;
}

async function recordDevice({ positionals: files, values }: Arguments) {
  const platform = NATIVE_PLATFORMS.find((name) => name === values.platform);
  const deviceId = values.device?.trim();
  const name = values.name?.trim();

  if (files.length > 0) {
    fail(
      "A device picture is taken by this command from a booted simulator or emulator, never given as a file. A web page in a phone-sized browser is a web capture: take it with pnpm pr:capture.",
    );
  }

  if (!platform || !deviceId || !name) {
    fail(
      "Give --platform android or apple, --device <simulator udid or emulator serial> and --name <the shot>.",
    );
  }

  const to = resolve(values.to ?? join(CAPTURE, "device"));

  const item = await takeDevicePicture({
    bridge: DEVICE_BRIDGES[platform],
    deviceId,
    name,
    platform,
    repository,
    to,
  });

  console.log(`${item.file} from ${item.device} in ${displayPath(join(to, MANIFEST))}.`);
  return true;
}

async function tiles({ positionals: [folder] }: Arguments) {
  const root = resolve(folder ?? CAPTURE);
  const { count, path } = await writeReadingSheet({ root, sheet: join(root, "read") });
  console.log(`${count} pictures to read: ${displayPath(path)}`);
  return true;
}

const COMMANDS = {
  adopt,
  before: recordBefore,
  check,
  device: recordDevice,
  pending: recordPending,
  read: recordRead,
  resolve: resolveFinding,
  tiles,
};

const parsed = readArguments();
const [command, ...rest] = parsed.positionals;

if (parsed.values.help || !command) {
  console.log(USAGE);
} else {
  const run = Object.entries(COMMANDS).find(([name]) => name === command)?.[1];

  if (!run) {
    fail(`Unknown command "${command}".`);
  }

  if (!(await run({ ...parsed, positionals: rest }))) {
    process.exitCode = 1;
  }
}
