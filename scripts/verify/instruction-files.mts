import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { z } from "zod";

// Codex stops loading project instructions at 32,768 bytes (`project_doc_max_bytes`), counted on the raw file.
const ROOT_BYTES = 26_000;

const FILE_BYTES = 9000;

const DESCRIPTION_BYTES = 250;

const OVER_BUDGET_UNTIL_SPLIT: Record<string, number> = {
  ".agents/skills/android-material-guidelines/SKILL.md": 16_000,
  ".agents/skills/android-material-guidelines/references/design-system.md": 46_000,
  ".agents/skills/apple-human-interface-guidelines/SKILL.md": 20_000,
  ".agents/skills/apple-human-interface-guidelines/references/design-system.md": 58_000,
  ".agents/skills/apple-human-interface-guidelines/references/official-links.md": 22_000,
  ".agents/skills/verify/references/pages.md": 48_000,
  ".agents/skills/zoonk-address-issue/SKILL.md": 14_000,
  ".agents/skills/zoonk-design/SKILL.md": 30_000,
  ".agents/skills/zoonk-design/references/app-patterns.md": 82_000,
  ".agents/skills/zoonk-design/references/color.md": 14_000,
  ".agents/skills/zoonk-design/references/craft.md": 58_000,
  ".agents/skills/zoonk-design/references/foldables.md": 14_000,
  "apps/android/AGENTS.md": 26_000,
  "apps/apple/AGENTS.md": 22_000,
};

const lockSchema = z.object({ skills: z.record(z.string(), z.unknown()).default({}) });

type Options = {
  descriptionBytes?: number;
  fileBytes?: number;
  overBudget?: Record<string, number>;
  rootBytes?: number;
};

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
          `${path} is ${bytes} bytes, over the ${ceiling} it may hold until it's split. Split it: move what not every task needs into its own file and link it, then lower this ceiling.`,
        ]
      : [];
  });
}

function description(skill: string): string | undefined {
  const lines = skill.replaceAll("\r\n", "\n");
  const frontmatter = /^---\n(?<yaml>[^]*?)\n---$/mu.exec(lines)?.groups?.yaml;

  return /^description:[ \t]*(?<text>.*)$/mu.exec(frontmatter ?? "")?.groups?.text?.trim();
}

/** Quotes, block scalars and a `: ` or ` #` inside the text change what YAML reads, or fail to parse. */
function isPlainLine(text: string): boolean {
  return !/^[|>'"[\]{}&*!%@`#,?-]|: | #/u.test(text);
}

function descriptionProblem(path: string, text: string | undefined, limit: number) {
  if (text === undefined || text === "") {
    return `${path} has no description: add one that says when to use the skill.`;
  }

  if (!isPlainLine(text)) {
    return `${path}'s description isn't one plain line: drop the quotes or block marker, and any ": " or " #" in it.`;
  }

  const bytes = Buffer.byteLength(text);

  return bytes > limit
    ? `${path}'s description is ${bytes} bytes, over the ${limit} every agent reads in every session. Say when to use the skill in a sentence or two, not what it holds.`
    : null;
}

function descriptionProblems(root: string, limit: number): string[] {
  return ownSkills(root)
    .map((name) => {
      const path = `.agents/skills/${name}/SKILL.md`;

      const text = isFile(join(root, path))
        ? description(readFileSync(join(root, path), "utf8"))
        : undefined;

      return descriptionProblem(path, text, limit);
    })
    .filter((problem) => problem !== null);
}

function reachableFrom(skillDirectory: string): Set<string> {
  const reached = new Set([join(skillDirectory, "SKILL.md")]);

  for (const file of reached) {
    if (file.startsWith(`${skillDirectory}/`) && file.endsWith(".md") && isFile(file)) {
      for (const target of linkTargets(readFileSync(file, "utf8"))) {
        reached.add(resolve(dirname(file), decodeURI(target.split("#")[0] ?? "")));
      }
    }
  }

  return reached;
}

function unlinkedProblems(root: string): string[] {
  return ownSkills(root).flatMap((name) => {
    const skillDirectory = join(root, ".agents/skills", name);
    const reached = reachableFrom(skillDirectory);

    return listMarkdown(skillDirectory)
      .filter((file) => !reached.has(file))
      .map(
        (file) =>
          `${relative(root, file)} can't be reached from its SKILL.md, so no agent reads it: link it from the entry with when to read it, or delete it.`,
      );
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
 * every file small, every skill's description short, every reference reachable from its entry, every link
 * and anchor resolving, and every skill reachable from `.claude/skills`.
 * Skills installed from elsewhere (`skills-lock.json`) aren't ours to edit, so only their symlinks are checked.
 */
export function instructionFileProblems(root: string, options: Options = {}): string[] {
  const files = instructionFiles(root);

  const settings = {
    descriptionBytes: options.descriptionBytes ?? DESCRIPTION_BYTES,
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
    ...descriptionProblems(root, settings.descriptionBytes),
    ...unlinkedProblems(root),
    ...linkProblems(root, files),
    ...symlinkProblems(root),
  ];
}
