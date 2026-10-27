import { execFileSync } from "node:child_process";

type Advisory = {
  findings: { paths: string[] }[];
  module_name: string;
  severity: string;
  title: string;
  url: string;
};

const SERIOUS = new Set(["critical", "high"]);
const OUTPUT_LIMIT_MB = 64;
const OUTPUT_LIMIT = OUTPUT_LIMIT_MB * 1024 * 1024;

/**
 * `pnpm audit --prod --json` (it exits non-zero when it finds advisories). Null when it couldn't
 * answer, such as the registry being unreachable: that's unverified, not clean.
 */
function audit(repository: string): Advisory[] | null {
  const run = () => {
    try {
      return execFileSync("pnpm", ["audit", "--prod", "--json"], {
        cwd: repository,
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

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- pnpm audit's JSON shape.
    const advisories = (report as { advisories: Record<string, Advisory> }).advisories;
    return Object.values(advisories).filter((advisory) => SERIOUS.has(advisory.severity));
  } catch {
    return null;
  }
}

/**
 * High and critical advisories in production dependencies, each marked as brought in by this
 * change (its package appears in the lockfile lines the change adds, which must be fixed) or
 * already there (named for whoever updates dependencies).
 */
export function auditDependencies(repository: string, addedLockLines: string[]): string[] {
  const advisories = audit(repository);

  if (!advisories) {
    return [
      "## Dependencies",
      "",
      "- [ ] **must fix** **Dependencies unverified**: `pnpm audit --prod` gave no answer (registry unreachable?). Run it again before committing.",
      "",
    ];
  }

  if (advisories.length === 0) {
    return ["## Dependencies", "", "`pnpm audit --prod`: no high or critical advisories.", ""];
  }

  return [
    "## Dependencies",
    "",
    ...advisories.map((advisory) => {
      const added = addedLockLines.some((line) => line.includes(`${advisory.module_name}@`));
      const via = advisory.findings[0]?.paths[0] ?? "";

      const label = added
        ? "**must fix** **Vulnerable dependency this change adds**"
        : "**Vulnerable dependency already installed**";

      return `- [ ] ${label}: ${advisory.module_name} (${advisory.severity}) ${advisory.title}, ${advisory.url}, via ${via}`;
    }),
    "",
  ];
}

/** Whether the audit found an advisory this change brought in, or couldn't answer. */
export function addsVulnerability(lines: string[]): boolean {
  return lines.some(
    (line) =>
      line.includes("Vulnerable dependency this change adds") ||
      line.includes("Dependencies unverified"),
  );
}
