import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Advisory = {
  findings: { paths: string[]; version: string }[];
  id: number;
  module_name: string;
  severity: string;
  title: string;
  url: string;
};

/** One vulnerable package as installed: an advisory, the version it hits, and how production reaches it. */
export type Exposure = { advisory: Advisory; path: string; version: string };

const SERIOUS = new Set(["critical", "high"]);
const OUTPUT_LIMIT_MB = 64;
const OUTPUT_LIMIT = OUTPUT_LIMIT_MB * 1024 * 1024;

/** What `pnpm audit` reads to know what production installs: the lockfile and the workspace. */
const INSTALL_FILES = ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"];

/**
 * `pnpm audit --prod --json` in `directory` (it exits non-zero when it finds advisories), as each
 * serious advisory's installed version and production path. Null when it couldn't answer, such as
 * the registry being unreachable: that's unverified, not clean.
 */
function audit(directory: string): Exposure[] | null {
  const run = () => {
    try {
      return execFileSync("pnpm", ["audit", "--prod", "--json"], {
        cwd: directory,
        encoding: "utf8",
        maxBuffer: OUTPUT_LIMIT,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch (error) {
      return error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
    }
  };

  try {
    const report: unknown = JSON.parse(run());

    if (!report || typeof report !== "object" || !("advisories" in report)) {
      return null;
    }

    const advisories = Object.values(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- pnpm audit's JSON shape.
      (report as { advisories: Record<string, Advisory> }).advisories,
    );

    return advisories
      .filter((advisory) => SERIOUS.has(advisory.severity))
      .flatMap((advisory) =>
        advisory.findings.flatMap((finding) =>
          finding.paths.map((path) => ({ advisory, path, version: finding.version })),
        ),
      );
  } catch {
    return null;
  }
}

/** The same audit of the base's lockfile and workspace, from a scratch folder. */
function auditBase(repository: string, base: string): Exposure[] | null {
  const directory = mkdtempSync(join(tmpdir(), "zoonk-audit-base-"));

  try {
    for (const file of INSTALL_FILES) {
      const content = execFileSync("git", ["show", `${base}:${file}`], {
        cwd: repository,
        encoding: "utf8",
        maxBuffer: OUTPUT_LIMIT,
      });

      writeFileSync(join(directory, file), content);
    }

    return audit(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

/** The same advisory at the same installed version is one exposure, however production reaches it. */
const key = ({ advisory, version }: Exposure) => `${advisory.id} ${version}`;

/**
 * One line per high or critical advisory in production dependencies. One the base's production
 * install didn't have at that version is brought in by this change (a new package, a new version,
 * or a dev dependency moved into production) and must be fixed; the rest are named for whoever
 * updates dependencies. Paths can't decide it: `pnpm audit` lists only a sample of a version's
 * paths, and a different one on each run.
 */
export function describeExposures({
  before,
  now,
}: {
  before: Exposure[];
  now: Exposure[];
}): string[] {
  const known = new Set(before.map((exposure) => key(exposure)));

  return [...Map.groupBy(now, key).values()].flatMap(([exposure]) => {
    if (!exposure) {
      return [];
    }

    const { advisory, path, version } = exposure;

    const label = known.has(key(exposure))
      ? "**Vulnerable dependency already installed**"
      : "**must fix** **Vulnerable dependency this change adds**";

    return [
      `- [ ] ${label}: ${advisory.module_name}@${version} (${advisory.severity}) ${advisory.title}, ${advisory.url}, via ${path}`,
    ];
  });
}

/** `pnpm audit --prod` now and at `base`, as the lines `describeExposures` writes. */
export function auditDependencies(repository: string, base: string): string[] {
  const now = audit(repository);
  const before = auditBase(repository, base);

  if (!now || !before) {
    return [
      "## Dependencies",
      "",
      "- [ ] **must fix** **Dependencies unverified**: `pnpm audit --prod` gave no answer (registry unreachable?). Run it again before committing.",
      "",
    ];
  }

  if (now.length === 0) {
    return ["## Dependencies", "", "`pnpm audit --prod`: no high or critical advisories.", ""];
  }

  return ["## Dependencies", "", ...describeExposures({ before, now }), ""];
}

/** Whether the audit found an advisory this change brought in, or couldn't answer. */
export function addsVulnerability(lines: string[]): boolean {
  return lines.some(
    (line) =>
      line.includes("Vulnerable dependency this change adds") ||
      line.includes("Dependencies unverified"),
  );
}
