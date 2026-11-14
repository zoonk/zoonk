/* oxlint-disable no-console -- This CLI prints what the check found and what to do next. */
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { bodyPictures, checkPictures, findManifests, formatCheck } from "./check.mts";
import {
  type Finding,
  type FindingState,
  MANIFEST,
  NATIVE_PLATFORMS,
  type PendingItem,
  type Read,
  SIDES,
  displayPath,
  pathWithin,
  readManifest,
  writeManifest,
} from "./media.mts";
import { resolveCommit, sha256File, sha256Text } from "./provenance.mts";
import { writeSection } from "./section.mts";
import { readablePictures, writeReadingSheet } from "./tiles.mts";

const repository = resolve(import.meta.dirname, "../..");
const CAPTURE = join(repository, "tmp/pr-media");

const USAGE = `Usage: pnpm pr:media check <body.md> [--root <dir>] [--manifests <dir>]...
       pnpm pr:media tiles [<dir>]
       pnpm pr:media read --by <reader> [--findings <file.json>] [<dir>]
       pnpm pr:media resolve <finding id> (--fixed <commit> | --exception <who granted it>) [<dir>]
       pnpm pr:media pending --platform <android|apple> --side <before|after> [--to <dir>] <file>...

Checks that every picture a PR body shows was captured, from which build, and read.

  check    fails when a picture in the body has no capture record with its bytes; when an after
           picture's build is unknown, has uncommitted changes, or is older than a later commit to
           its app or packages/; when an after picture has no read or an unresolved finding; when
           a capture's alignment.json reports unresolved layout findings or missing scenarios;
           and when a native picture is still pending. Picture paths are relative to --root (the
           body's folder by default); capture.json files are found under it and under each
           --manifests folder. Exits non-zero on any failure.
  tiles    cuts every after picture under <dir> into original-size tiles and writes
           <dir>/read/READ.md, the reader's sheet: pictures first, numbers second, then words.
  read     records a read on every after picture under <dir> that has none: clean, or the
           findings in the file, a JSON array of { "file", "text" } with files as READ.md lists them.
  resolve  marks a finding fixed in a commit, or an exception the user granted.
  pending  records native pictures with no capture record yet; they keep failing the check as
           pending until their platform's capture writes the record.

<dir> is tmp/pr-media by default, where pnpm pr:capture writes. After read or resolve there, the
before-and-after section is written again once the check passes.`;

function readArguments() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        by: { type: "string" },
        exception: { type: "string" },
        findings: { type: "string" },
        fixed: { type: "string" },
        help: { default: false, short: "h", type: "boolean" },
        manifests: { default: [], multiple: true, type: "string" },
        platform: { type: "string" },
        root: { type: "string" },
        side: { type: "string" },
        to: { default: join(CAPTURE, "native"), type: "string" },
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
  const searched = [root, ...values.manifests.map((folder) => resolve(folder))];
  const found = await Promise.all(searched.map(async (folder) => findManifests(folder)));
  const manifests = found.flat();

  const result = await checkPictures({
    manifests,
    pictures: bodyPictures(markdown).map((link) =>
      /^[a-z][a-z0-9+.-]*:\/\//iu.test(link) ? link : resolve(root, link),
    ),
    repository,
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

type ReadFinding = { files: string[]; finding: Finding };

const FINDING_ID_LENGTH = 8;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** One id per finding, shared by every picture it names, so resolving it resolves them all. */
function toReadFinding(entry: unknown): ReadFinding | undefined {
  if (typeof entry !== "object" || entry === null) {
    return undefined;
  }

  const field = (key: string): unknown => Reflect.get(entry, key);

  const [crop, file, measurement, text] = ["crop", "file", "measurement", "text"].map((key) =>
    field(key),
  );

  const listed: unknown[] = Array.isArray(file) ? file : [file];
  const files = listed.filter((name) => isText(name));

  if (!isText(text) || files.length === 0 || files.length !== listed.length) {
    return undefined;
  }

  const extra = { ...(isText(measurement) && { measurement }), ...(isText(crop) && { crop }) };
  const id = sha256Text(JSON.stringify([files, text])).slice(0, FINDING_ID_LENGTH);
  return { files, finding: { id, state: "open", text, ...extra } };
}

async function readFindingsFile(path: string | undefined): Promise<ReadFinding[]> {
  if (!path) {
    return [];
  }

  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  const entries = Array.isArray(parsed) ? parsed.map((entry) => toReadFinding(entry)) : [undefined];
  const valid = entries.filter((entry) => entry !== undefined);

  if (valid.length !== entries.length) {
    fail(
      `${path} must be a JSON array of { "file", "text" }, where "file" may list several pictures and "measurement" and "crop" are optional.`,
    );
  }

  return valid;
}

async function recordRead({ positionals: [folder], values }: Arguments) {
  const by = values.by ?? fail("Say who read the pictures with --by.");
  const root = resolve(folder ?? CAPTURE);
  const pictures = await readablePictures(root);
  const unread = pictures.filter(({ item }) => !item.read);
  const entries = await readFindingsFile(values.findings);
  const known = new Set(unread.map(({ id }) => id));
  const strays = entries.flatMap(({ files }) => files.filter((file) => !known.has(file)));

  if (strays.length > 0) {
    fail(`These findings name no unread after picture under ${root}: ${strays.join(", ")}`);
  }

  const at = new Date().toISOString();

  for (const [manifest, list] of Map.groupBy(unread, (picture) => picture.folder)) {
    const bySha = new Map(list.map((picture) => [picture.item.sha256, picture.id]));
    // oxlint-disable-next-line no-await-in-loop -- One manifest at a time.
    const items = (await readManifest(manifest)) ?? [];

    const updated = items.map((item) => {
      const id = bySha.get(item.sha256);

      if (id === undefined) {
        return item;
      }

      const findings = entries.flatMap(({ files, finding }) =>
        files.includes(id) ? [finding] : [],
      );

      const read: Read = { at, by, findings };
      return { ...item, read };
    });

    // oxlint-disable-next-line no-await-in-loop -- See above.
    await writeManifest(manifest, updated);
  }

  console.log(
    `Recorded ${by}'s read of ${unread.length} pictures (${pictures.length - unread.length} already read), ${entries.length} findings.`,
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
      const found = items.some((item) => item.read?.findings.some((finding) => finding.id === id));

      if (found) {
        await writeManifest(
          manifest,
          items.map((item) =>
            item.read
              ? {
                  ...item,
                  read: { ...item.read, findings: resolveIn(item.read.findings, id, state) },
                }
              : item,
          ),
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

async function recordPending({ positionals: files, values }: Arguments) {
  const platform = NATIVE_PLATFORMS.find((name) => name === values.platform);
  const side = SIDES.find((name) => name === values.side);

  if (!platform || !side || files.length === 0) {
    fail("Give --platform android or apple, --side before or after, and the pictures.");
  }

  const to = resolve(values.to);
  await mkdir(to, { recursive: true });

  const added: PendingItem[] = await Promise.all(
    files.map(async (file) => ({
      file: pathWithin(to, resolve(file)),
      kind: VIDEO_EXTENSIONS.has(extname(file)) ? ("video" as const) : ("shot" as const),
      platform,
      sha256: await sha256File(file),
      side,
    })),
  );

  const hashes = new Set(added.map((item) => item.sha256));
  const kept = ((await readManifest(to)) ?? []).filter((item) => !hashes.has(item.sha256));
  await writeManifest(to, [...kept, ...added]);

  console.log(
    `${added.length} ${platform} pictures pending in ${displayPath(join(to, MANIFEST))}.`,
  );

  return true;
}

async function tiles({ positionals: [folder] }: Arguments) {
  const root = resolve(folder ?? CAPTURE);
  const { count, path } = await writeReadingSheet({ root, sheet: join(root, "read") });
  console.log(`${count} pictures to read: ${displayPath(path)}`);
  return true;
}

const COMMANDS = {
  check,
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
