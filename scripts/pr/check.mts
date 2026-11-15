import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readCaptures } from "../verify/alignment-validate.mts";
import { evaluateFile } from "../verify/alignment.mts";
import { type DevicePicture } from "./body.mts";
import { isRemote } from "./locate.mts";
import {
  type AlignmentReport,
  type CaptureItem,
  type Finding,
  type ManifestItem,
  buildOf,
  isRecorded,
  readAlignment,
  readManifest,
  readOf,
} from "./media.mts";
import { placementProblems } from "./placement.mts";
import { commitIncludes, latestCommitSince, sha256File } from "./provenance.mts";
import { type CheckResult, type Problem } from "./report.mts";

type Entry = { folder: string; item: ManifestItem };

type Judged = AlignmentReport & { refused?: string };

type Manifest = { alignment: Judged; folder: string; items: ManifestItem[] };

/**
 * The captures a folder holds are judged here, by the one evaluator, whatever wrote them: a native
 * capture stores captures without findings, and stored findings could be older than the rules.
 */
function judge(report: AlignmentReport): Judged {
  if (!report.captures?.length) {
    return report;
  }

  const read = readCaptures(report);

  if (read.kind !== "captures") {
    return { ...report, refused: read.kind === "invalid" ? read.problems : "no captures" };
  }

  return { ...report, ...evaluateFile(read.file) };
}

async function loadManifests(folders: string[]): Promise<Manifest[]> {
  const unique = [...new Set(folders.map((folder) => resolve(folder)))];

  return Promise.all(
    unique.map(async (folder) => ({
      alignment: judge(await readAlignment(folder)),
      folder,
      items: (await readManifest(folder)) ?? [],
    })),
  );
}

type Git = {
  includes: (commit: string, ancestor: string) => Promise<boolean>;
  latestSince: (commit: string, app: string) => Promise<string | undefined>;
};

function cachedGit(repository: string): Git {
  const included = new Map<string, Promise<boolean>>();
  const latest = new Map<string, Promise<string | undefined>>();

  return {
    includes: async (commit, ancestor) => {
      const key = `${commit} ${ancestor}`;

      if (!included.has(key)) {
        included.set(key, commitIncludes({ ancestor, commit, repository }));
      }

      return included.get(key) ?? false;
    },
    latestSince: async (commit, app) => {
      const key = `${commit} ${app}`;

      if (!latest.has(key)) {
        latest.set(
          key,
          latestCommitSince({ commit, paths: [`apps/${app}`, "packages"], repository }),
        );
      }

      return latest.get(key);
    },
  };
}

async function buildProblems({
  git,
  item,
  picture,
}: {
  git: Git;
  item: CaptureItem;
  picture: string;
}): Promise<Problem[]> {
  const { app, changes, commit, id } = buildOf(item);

  // An emulator's app names no commit: its line under the device heading says so.
  if (item.device && commit === "unknown") {
    return [];
  }

  if (id === "unknown") {
    return [{ kind: "unknown-build", picture }];
  }

  if (changes) {
    return [{ kind: "uncommitted", picture }];
  }

  const head = await git.latestSince(commit, app);

  return head === undefined ? [] : [{ detail: head, kind: "stale", picture }];
}

async function findingProblems({
  findings,
  git,
  item,
  picture,
}: {
  findings: Finding[];
  git: Git;
  item?: CaptureItem;
  picture: string;
}): Promise<Problem[]> {
  const problems = await Promise.all(
    findings.map(async (finding): Promise<Problem | undefined> => {
      const detail = `${finding.id}: ${finding.text}`;

      if (finding.state === "open") {
        return { detail, kind: "finding", picture };
      }

      if (finding.state === "fixed") {
        const shown = item && (await git.includes(buildOf(item).commit, finding.commit));
        return shown ? undefined : { detail, kind: "fixed-not-retaken", picture };
      }

      return undefined;
    }),
  );

  return problems.filter((problem) => problem !== undefined);
}

async function itemProblems({
  git,
  item,
  picture,
}: {
  git: Git;
  item: ManifestItem;
  picture: string;
}): Promise<Problem[]> {
  if (item.side === "before") {
    return [];
  }

  if (!isRecorded(item)) {
    return [{ kind: "pending", picture }];
  }

  const read = readOf(item);

  const findings: Problem[] = read
    ? await findingProblems({ findings: read.findings, git, item, picture })
    : [{ kind: "unread", picture }];

  return [...(await buildProblems({ git, item, picture })), ...findings];
}

/**
 * Matched by bytes, so a capture copied elsewhere keeps its record. Every after record with those
 * bytes applies, so no other record, whatever its order, excuses a picture an after holds to more.
 */
async function pictureProblems({
  byHash,
  byPath,
  git,
  picture,
}: {
  byHash: Map<string, Entry[]>;
  byPath: Map<string, Entry>;
  git: Git;
  picture: string;
}): Promise<{ entries: Entry[]; problems: Problem[] }> {
  if (isRemote(picture)) {
    return { entries: [], problems: [{ kind: "remote", picture }] };
  }

  if (!existsSync(picture)) {
    return { entries: [], problems: [{ kind: "missing", picture }] };
  }

  const sha256 = await sha256File(picture);
  const own = byPath.get(picture);

  if (own && own.item.sha256 !== sha256) {
    return { entries: [], problems: [{ kind: "changed", picture }] };
  }

  const entries = byHash.get(sha256) ?? [];

  if (entries.length === 0) {
    return { entries, problems: [{ kind: "unrecorded", picture }] };
  }

  const afters = entries.filter(({ item }) => item.side === "after");

  const problems = await Promise.all(
    afters.map(async ({ item }) => itemProblems({ git, item, picture })),
  );

  const unique = new Map(problems.flat().map((problem) => [JSON.stringify(problem), problem]));
  return { entries, problems: [...unique.values()] };
}

/** A device picture has no capture to measure: it's shown under its own heading instead. */
function measured({ alignment, items }: Manifest): boolean {
  const { captures = [], findings = [] } = alignment;
  const captured = items.some((item) => isRecorded(item) && !item.device);
  return !captured || captures.length + findings.length > 0;
}

function alignmentProblems({ alignment, folder }: Manifest): Problem[] {
  if (alignment.refused !== undefined) {
    const [first = ""] = alignment.refused.split("\n");
    const detail = `alignment.json isn't a capture the evaluator reads: ${first}`;
    return [{ detail, kind: "alignment", picture: folder }];
  }

  // The evaluator's verdict: what fails and what it couldn't measure, as `verify:alignment` fails.
  const { findings = [], summary = {} } = alignment;

  const messages = [
    ...new Set(
      findings.flatMap((finding) => {
        if (finding.level === "fail" && !finding.exception) {
          return [finding.message];
        }

        return finding.level === "not-measured" ? [`not measured: ${finding.message}`] : [];
      }),
    ),
  ];

  const counted = [
    ...(summary.unresolved ? [`${summary.unresolved} unresolved`] : []),
    ...(summary.notMeasured ? [`${summary.notMeasured} not measured`] : []),
  ];

  const missing = summary.scenariosMissing ?? 0;
  const details = messages.length > 0 ? messages : counted;

  const problems: Problem[] = details.map((detail) => ({
    detail,
    kind: "alignment",
    picture: folder,
  }));

  return missing > 0
    ? [...problems, { detail: `${missing} missing`, kind: "scenarios", picture: folder }]
    : problems;
}

/**
 * Before pictures need only their capture record: an old before is expected. After pictures also
 * need a known, committed build no later commit to their app or the shared packages outdates, and
 * a read with no unresolved finding. A native picture without its platform's record is pending.
 * `onDevice` are the pictures under the device heading, each listed with what was verified.
 */
export async function checkPictures({
  manifests,
  onDevice = [],
  pictures,
  repository,
  unsupported = [],
}: {
  manifests: string[];
  onDevice?: DevicePicture[];
  pictures: string[];
  repository: string;
  unsupported?: string[];
}): Promise<CheckResult> {
  const loaded = await loadManifests(manifests);
  const git = cachedGit(repository);

  const entries = loaded.flatMap(({ folder, items }) => items.map((item) => ({ folder, item })));
  const byHash = Map.groupBy(entries, (entry) => entry.item.sha256);
  const byPath = new Map(entries.map((entry) => [resolve(entry.folder, entry.item.file), entry]));

  // Every occurrence is placed and captioned by itself; each picture's records are looked up once.
  const shown: { caption?: string; path: string }[] = [
    ...pictures.map((path) => ({ path })),
    ...onDevice,
  ];

  const paths = [...new Set(shown.map(({ path }) => path))];

  const lookups = new Map(
    await Promise.all(
      paths.map(
        async (picture) =>
          [picture, await pictureProblems({ byHash, byPath, git, picture })] as const,
      ),
    ),
  );

  const checked = shown.map(({ caption, path: picture }) => {
    const found = lookups.get(picture) ?? { entries: [], problems: [] };
    const items = found.entries.map(({ item }) => item);
    const placed = placementProblems({ caption, items, picture });
    return { ...found, line: placed.line, picture, placed: placed.problems };
  });

  const problems = [
    ...[...lookups.values()].flatMap((found) => found.problems),
    ...checked.flatMap(({ placed }) => placed),
  ];

  const devices = [
    ...new Map(
      checked.flatMap(({ line, picture }) => (line ? [[picture, { line, picture }] as const] : [])),
    ).values(),
  ];

  const matched = new Set(checked.flatMap(({ entries: found }) => found));
  const after = [...matched].flatMap(({ item }) => (item.side === "after" ? [item] : []));

  // A before's layout is the fault the change fixes, so only folders holding an after are judged.
  const judged = new Set(
    [...matched].flatMap(({ folder, item }) => (item.side === "after" ? [folder] : [])),
  );

  const read = after.flatMap((item) => readOf(item) ?? []);

  const reads = {
    carried: read.filter((record) => record.carriedFrom).length,
    missing: after.length - read.length,
    new: read.filter((record) => !record.carriedFrom).length,
  };

  const judgedManifests = loaded.filter(({ folder }) => judged.has(folder));
  const fromAlignment = judgedManifests.flatMap((manifest) => alignmentProblems(manifest));
  const unreadable = unsupported.map((detail): Problem => ({ detail, kind: "unsupported" }));

  return {
    checked: paths.length,
    devices,
    notMeasured: judgedManifests.filter((manifest) => !measured(manifest)).length,
    nothingDeclared: judgedManifests
      .flatMap(({ alignment }) => alignment.captures ?? [])
      .filter((screen) => screen.elements?.length === 0).length,
    problems: [
      ...unreadable,
      ...new Map(problems.map((problem) => [JSON.stringify(problem), problem])).values(),
      ...fromAlignment,
    ],
    reads,
  };
}
