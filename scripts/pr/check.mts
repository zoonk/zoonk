import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  type AlignmentReport,
  type CaptureItem,
  type Finding,
  MANIFEST,
  type ManifestItem,
  isRecorded,
  readAlignment,
  readManifest,
} from "./media.mts";
import { commitIncludes, latestCommitSince, sha256File } from "./provenance.mts";

/** In the order they print: what can't be bound first, then what a retake fixes, then the read. */
const KINDS = [
  { kind: "missing", label: "Not found", summary: "not found" },
  {
    kind: "remote",
    label: "Not a local file: check the body before uploading",
    summary: "not local",
  },
  {
    kind: "changed",
    label: "Changed since its capture: its bytes don't match its manifest",
    summary: "changed since capture",
  },
  {
    kind: "unrecorded",
    label: "Not in any capture manifest: take it with pnpm pr:capture",
    summary: "not in any capture manifest",
  },
  { kind: "pending", label: "Pending: no native capture record yet", summary: "pending" },
  {
    kind: "unknown-build",
    label: "After picture from an unknown build: serve this checkout with pnpm start and retake",
    summary: "from an unknown build",
  },
  {
    kind: "uncommitted",
    label: "After picture built with uncommitted changes: commit, rebuild and retake",
    summary: "built with uncommitted changes",
  },
  {
    kind: "stale",
    label: "After picture older than a later commit to its app or the shared packages: retake",
    summary: "stale",
  },
  {
    kind: "unread",
    label: "No read recorded: run pnpm pr:media tiles, read, then pnpm pr:media read",
    summary: "with no read",
  },
  { kind: "finding", label: "Unresolved finding from the read", summary: "unresolved findings" },
  {
    kind: "fixed-not-retaken",
    label: "Finding fixed after the picture was taken: retake",
    summary: "fixed but not retaken",
  },
  {
    kind: "alignment",
    label: "Unresolved layout finding in the capture's alignment.json",
    summary: "unresolved layout findings",
  },
  {
    kind: "scenarios",
    label: "Required scenarios the capture's alignment.json says are missing",
    summary: "captures missing scenarios",
  },
] as const;

type Kind = (typeof KINDS)[number]["kind"];

function isRemote(picture: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//iu.test(picture);
}

type Problem = { detail?: string; kind: Kind; picture: string };

export type CheckResult = { checked: number; problems: Problem[] };

type Entry = { folder: string; item: ManifestItem };

type Manifest = { alignment: AlignmentReport; folder: string; items: ManifestItem[] };

const PICTURE_LINK =
  /!\[[^\]]*\]\((?<markdown>[^)\s]+)(?:\s+"[^"]*")?\)|<img\b[^>]*\ssrc="(?<html>[^"]+)"/giu;

export function bodyPictures(markdown: string): string[] {
  const links = [...markdown.matchAll(PICTURE_LINK)].map(
    (match) => match.groups?.markdown ?? match.groups?.html ?? "",
  );

  return [...new Set(links)];
}

export async function findManifests(root: string): Promise<string[]> {
  if (!existsSync(root)) {
    return [];
  }

  const paths = await readdir(root, { recursive: true });

  return paths
    .filter((path) => basename(path) === MANIFEST)
    .map((path) => dirname(join(root, path)));
}

async function loadManifests(folders: string[]): Promise<Manifest[]> {
  const unique = [...new Set(folders.map((folder) => resolve(folder)))];

  return Promise.all(
    unique.map(async (folder) => ({
      alignment: await readAlignment(folder),
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
  const { app, changes, commit, id } = item.build;

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
        const shown = item && (await git.includes(item.build.commit, finding.commit));
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
  if (!isRecorded(item)) {
    return [{ kind: "pending", picture }];
  }

  if (item.side === "before") {
    return [];
  }

  const findings: Problem[] = item.read
    ? await findingProblems({ findings: item.read.findings, git, item, picture })
    : [{ kind: "unread", picture }];

  return [...(await buildProblems({ git, item, picture })), ...findings];
}

/** Matched by bytes, so a capture copied elsewhere keeps its record. */
async function pictureProblems({
  byHash,
  byPath,
  git,
  picture,
}: {
  byHash: Map<string, Entry>;
  byPath: Map<string, Entry>;
  git: Git;
  picture: string;
}): Promise<{ entry?: Entry; problems: Problem[] }> {
  if (isRemote(picture)) {
    return { problems: [{ kind: "remote", picture }] };
  }

  if (!existsSync(picture)) {
    return { problems: [{ kind: "missing", picture }] };
  }

  const entry = byHash.get(await sha256File(picture));

  if (!entry) {
    return { problems: [{ kind: byPath.has(picture) ? "changed" : "unrecorded", picture }] };
  }

  return { entry, problems: await itemProblems({ git, item: entry.item, picture }) };
}

function alignmentProblems({ alignment, folder }: Manifest): Problem[] {
  const { findings = [], summary = {} } = alignment;
  const failing = findings.filter((finding) => finding.level === "fail" && !finding.exception);
  const messages = [...new Set(failing.map((finding) => finding.message))];
  const unresolved = summary.unresolved ?? 0;
  const missing = summary.scenariosMissing ?? 0;
  const details = messages.length > 0 || unresolved === 0 ? messages : [`${unresolved} unresolved`];

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
 */
export async function checkPictures({
  manifests,
  pictures,
  repository,
}: {
  manifests: string[];
  pictures: string[];
  repository: string;
}): Promise<CheckResult> {
  const loaded = await loadManifests(manifests);
  const git = cachedGit(repository);

  const entries = loaded.flatMap(({ folder, items }) => items.map((item) => ({ folder, item })));
  const byHash = new Map(entries.map((entry) => [entry.item.sha256, entry]));
  const byPath = new Map(entries.map((entry) => [resolve(entry.folder, entry.item.file), entry]));
  const unique = [...new Set(pictures)];

  const checked = await Promise.all(
    unique.map(async (picture) => pictureProblems({ byHash, byPath, git, picture })),
  );

  const used = new Set(checked.flatMap(({ entry }) => (entry ? [entry.folder] : [])));

  const fromAlignment = loaded
    .filter(({ folder }) => used.has(folder))
    .flatMap((manifest) => alignmentProblems(manifest));

  return {
    checked: unique.length,
    problems: [...checked.flatMap(({ problems }) => problems), ...fromAlignment],
  };
}

function kindOf(kind: Kind) {
  const index = KINDS.findIndex((entry) => entry.kind === kind);
  const { label, summary } = KINDS[index] ?? { label: kind, summary: kind };
  return { index, label, summary };
}

export function formatCheck({ checked, problems }: CheckResult, root: string): string {
  const groups = [...Map.groupBy(problems, (problem) => problem.kind)].toSorted(
    ([first], [second]) => kindOf(first).index - kindOf(second).index,
  );

  const shown = (picture: string) => (isRemote(picture) ? picture : relative(root, picture));

  const lines = groups.flatMap(([kind, list]) => [
    `${kindOf(kind).label} (${list.length})`,
    ...list.map(({ detail, picture }) => `  ${shown(picture)}${detail ? `: ${detail}` : ""}`),
  ]);

  const summary =
    groups.length === 0
      ? `PASS: ${checked} pictures, each in a capture manifest; every after picture from a current, committed build and read`
      : `FAIL: ${groups.map(([kind, list]) => `${list.length} ${kindOf(kind).summary}`).join("; ")}, of ${checked} pictures`;

  return [...lines, summary].join("\n");
}
