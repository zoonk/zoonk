import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { z } from "zod";

// Codex stops loading project instructions at 32,768 bytes (`project_doc_max_bytes`), counted on the raw file.
const ROOT_BYTES = 26_000;

const FILE_BYTES = 9000;

const OVER_BUDGET_UNTIL_SPLIT: Record<string, number> = {
  ".agents/skills/android-material-guidelines/SKILL.md": 16_000,
  ".agents/skills/android-material-guidelines/references/design-system.md": 46_000,
  ".agents/skills/apple-human-interface-guidelines/SKILL.md": 20_000,
  ".agents/skills/apple-human-interface-guidelines/references/design-system.md": 58_000,
  ".agents/skills/apple-human-interface-guidelines/references/official-links.md": 22_000,
  ".agents/skills/verify/references/pages.md": 48_000,
  ".agents/skills/zoonk-address-issue/SKILL.md": 18_000,
  ".agents/skills/zoonk-design/SKILL.md": 30_000,
  ".agents/skills/zoonk-design/references/app-patterns.md": 82_000,
  ".agents/skills/zoonk-design/references/color.md": 14_000,
  ".agents/skills/zoonk-design/references/craft.md": 58_000,
  ".agents/skills/zoonk-design/references/foldables.md": 14_000,
  ".agents/skills/zoonk-persona-walkthrough/references/personas.md": 14_000,
  "apps/android/AGENTS.md": 26_000,
  "apps/apple/AGENTS.md": 22_000,
};

const lockSchema = z.object({ skills: z.record(z.string(), z.unknown()).default({}) });

type Options = { fileBytes?: number; overBudget?: Record<string, number>; rootBytes?: number };

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function listDirectories(path: string): string[] {
  return isDirectory(path) ? readdirSync(path).filter((name) => isDirectory(join(path, name))) : [];
}

function listMarkdown(path: string): string[] {
  if (!isDirectory(path)) {
    return [];
  }

  return readdirSync(path, { recursive: true })
    .map((entry) => join(path, String(entry)))
    .filter((file) => file.endsWith(".md") && !file.includes("node_modules") && isFile(file));
}

function installedSkills(root: string): Set<string> {
  const lock = join(root, "skills-lock.json");

  return new Set(
    isFile(lock)
      ? Object.keys(lockSchema.parse(JSON.parse(readFileSync(lock, "utf8"))).skills)
      : [],
  );
}

function ownSkills(root: string): string[] {
  const installed = installedSkills(root);

  return listDirectories(join(root, ".agents/skills")).filter((name) => !installed.has(name));
}

function instructionFiles(root: string): string[] {
  const scoped = ["apps", "packages"].flatMap((group) =>
    listDirectories(join(root, group)).map((name) => join(root, group, name, "AGENTS.md")),
  );

  return [
    join(root, "AGENTS.md"),
    ...scoped,
    ...listMarkdown(join(root, ".agents/guides")),
    ...ownSkills(root).flatMap((name) => listMarkdown(join(root, ".agents/skills", name))),
  ].filter((file) => isFile(file));
}

function withoutCode(markdown: string): string {
  return markdown
    .replaceAll(/^(?:```|~~~)[^]*?^(?:```|~~~)[^\n]*$/gmu, "")
    .replaceAll(/`[^`\n]*`/gu, "");
}

function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replaceAll(/\[(?<text>[^\]]*)\]\([^)]*\)/gu, "$<text>")
    .replaceAll(/[^\p{L}\p{N}\- _]/gu, "")
    .replaceAll(" ", "-");
}

function anchors(markdown: string): Set<string> {
  const seen = new Map<string, number>();

  const fenced = markdown.replaceAll(/^(?:```|~~~)[^]*?^(?:```|~~~)[^\n]*$/gmu, "");

  return new Set(
    [...fenced.matchAll(/^#{1,6}\s+(?<heading>.+)$/gmu)].map((match) => {
      const base = slug(match.groups?.heading ?? "");
      const count = seen.get(base) ?? 0;

      seen.set(base, count + 1);

      return count === 0 ? base : `${base}-${count}`;
    }),
  );
}

function linkTargets(markdown: string): string[] {
  return [...withoutCode(markdown).matchAll(/\]\((?:<(?<angled>[^>]+)>|(?<plain>[^)\s]+))/gu)]
    .map((match) => match.groups?.angled ?? match.groups?.plain ?? "")
    .filter((target) => target !== "" && !/^[a-z][a-z0-9+.-]*:/iu.test(target));
}

function linkProblem({ file, root, target }: { file: string; root: string; target: string }) {
  const [path = "", anchor = ""] = target.split("#");
  const destination = path === "" ? file : resolve(dirname(file), decodeURI(path));
  const from = relative(root, file);

  if (statSync(destination, { throwIfNoEntry: false }) === undefined) {
    return `${from}: the link to ${target} points at a file that doesn't exist`;
  }

  if (anchor !== "" && destination.endsWith(".md") && isFile(destination)) {
    return anchors(readFileSync(destination, "utf8")).has(anchor)
      ? null
      : `${from}: the link to ${target} names a heading ${relative(root, destination)} doesn't have`;
  }

  return null;
}

function linkProblems(root: string, files: string[]): string[] {
  return files.flatMap((file) =>
    linkTargets(readFileSync(file, "utf8"))
      .map((target) => linkProblem({ file, root, target }))
      .filter((problem) => problem !== null),
  );
}

/**
 * `oxfmt` pads every table row to its widest cell, which costs bytes and almost no tokens, so a
 * file's size is measured with that padding collapsed. The root file is measured raw, since the
 * limit it must stay under is in bytes.
 */
function measuredBytes(markdown: string): number {
  return Buffer.byteLength(markdown.replaceAll(/ {2,}/gu, " ").replaceAll(/-{4,}/gu, "---"));
}

function sizeProblems(root: string, files: string[], options: Required<Options>): string[] {
  return files.flatMap((file) => {
    const path = relative(root, file);
    const content = readFileSync(file, "utf8");

    if (path === "AGENTS.md") {
      const bytes = Buffer.byteLength(content);

      return bytes > options.rootBytes
        ? [
            `AGENTS.md is ${bytes} bytes, over its ${options.rootBytes}. It loads on every turn: move a procedure, a case list or one area's rules to the small file its index points at.`,
          ]
        : [];
    }

    const bytes = measuredBytes(content);
    const ceiling = options.overBudget[path];

    if (ceiling === undefined) {
      return bytes > options.fileBytes
        ? [
            `${path} is ${bytes} bytes, over the ${options.fileBytes} a file with one subject needs. Split it by subject and link the parts from its entry or the root index.`,
          ]
        : [];
    }

    if (bytes <= options.fileBytes) {
      return [`${path} is under the budget now: remove it from OVER_BUDGET_UNTIL_SPLIT.`];
    }

    return bytes > ceiling
      ? [
          `${path} is ${bytes} bytes, over the ${ceiling} it may hold until it's split. Take as much out as you add, or split it by subject.`,
        ]
      : [];
  });
}

function symlinkProblems(root: string): string[] {
  return listDirectories(join(root, ".agents/skills")).flatMap((name) => {
    const link = join(root, ".claude/skills", name);
    const linked = statSync(link, { throwIfNoEntry: false }) !== undefined;

    return linked && realpathSync(link) === realpathSync(join(root, ".agents/skills", name))
      ? []
      : [
          `.claude/skills/${name} doesn't resolve to .agents/skills/${name}: add its relative symlink.`,
        ];
  });
}

/**
 * Holds the instruction files agents load to what keeps them cheap to read and safe to follow:
 * every file small, every link and anchor resolving, and every skill reachable from `.claude/skills`.
 * Skills installed from elsewhere (`skills-lock.json`) aren't ours to edit, so only their symlinks are checked.
 */
export function instructionFileProblems(root: string, options: Options = {}): string[] {
  const files = instructionFiles(root);

  const settings = {
    fileBytes: options.fileBytes ?? FILE_BYTES,
    overBudget: options.overBudget ?? OVER_BUDGET_UNTIL_SPLIT,
    rootBytes: options.rootBytes ?? ROOT_BYTES,
  };

  const missing = Object.keys(settings.overBudget)
    .filter((path) => !isFile(join(root, path)))
    .map((path) => `${path} is gone: remove it from OVER_BUDGET_UNTIL_SPLIT.`);

  return [
    ...sizeProblems(root, files, settings),
    ...missing,
    ...linkProblems(root, files),
    ...symlinkProblems(root),
  ];
}
