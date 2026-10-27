import { DESIGN_RULES } from "./rules/design.mts";
import { ENGINEERING_RULES } from "./rules/engineering.mts";
import { SECURITY_RULES } from "./rules/security.mts";
import { type Role, type Rule } from "./rules/shared.mts";

const RULES = [...SECURITY_RULES, ...ENGINEERING_RULES, ...DESIGN_RULES];

/** A file in the diff: the lines it adds (by their new line number) and whether the change creates it. */
export type ChangedFile = {
  added: { line: number; text: string }[];
  created: boolean;
  path: string;
};

/** Lines one rule flagged in one file. */
export type Flag = { lines: number[]; path: string; rule: Rule; sample: string };

const HUNK = /^@@ -\d+(?:,\d+)? \+(?<start>\d+)(?:,\d+)? @@/u;
const SAMPLE_LENGTH = 100;

/** The files a `git diff --unified=0` adds lines to, with each added line's number. */
export function parseDiff(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const position = { inHunk: false, line: 0 };

  for (const text of diff.split("\n")) {
    const current = files.at(-1);
    const hunk = HUNK.exec(text);

    if (text.startsWith("diff --git ")) {
      files.push({ added: [], created: false, path: "" });
      position.inHunk = false;
    } else if (hunk) {
      position.inHunk = true;
      position.line = Number(hunk.groups?.start ?? 0);
    } else if (current && position.inHunk && text.startsWith("+")) {
      current.added.push({ line: position.line, text: text.slice(1) });
      position.line += 1;
    } else if (current && text.startsWith("new file mode")) {
      current.created = true;
    } else if (current && text.startsWith("+++ ")) {
      current.path = text.replace(/^\+\+\+ (?:b\/)?/u, "");
    }
  }

  return files.filter((file) => file.path && file.path !== "/dev/null");
}

function applies(rule: Rule, file: ChangedFile, isClient: boolean): boolean {
  const side = isClient ? "client" : "server";
  return (!rule.files || rule.files.test(file.path)) && (!rule.side || rule.side === side);
}

/**
 * Every rule's hits in the changed files: added lines it matches, and files it covers that the
 * change creates. `isClient` tells whether a file's current content says `"use client"`.
 */
export function auditDiff(files: ChangedFile[], isClient: (path: string) => boolean): Flag[] {
  return files.flatMap((file) => {
    const client = isClient(file.path);

    return RULES.flatMap((rule): Flag[] => {
      const createdHit = file.created && rule.created?.test(file.path);

      const lines =
        rule.line && applies(rule, file, client)
          ? file.added.filter((added) => rule.line?.test(added.text))
          : [];

      if (lines.length === 0 && !createdHit) {
        return [];
      }

      return [
        {
          lines: lines.map((added) => added.line),
          path: file.path,
          rule,
          sample: (lines[0]?.text ?? "").trim().slice(0, SAMPLE_LENGTH),
        },
      ];
    });
  });
}

const ROLES: { role: Role; title: string }[] = [
  { role: "security", title: "Security researcher" },
  { role: "engineering", title: "Principal engineer" },
  { role: "design", title: "Designer" },
];

/** The audit as a checklist the author answers in the report, by role, blocking items first. */
export function renderAudit(flags: Flag[]): string[] {
  return ROLES.flatMap(({ role, title }) => {
    const mine = flags
      .filter((flag) => flag.rule.role === role)
      .toSorted((a, b) => Number(Boolean(b.rule.blocks)) - Number(Boolean(a.rule.blocks)));

    if (mine.length === 0) {
      return [];
    }

    return [
      `## ${title}`,
      "",
      ...mine.map((flag) => {
        const where =
          flag.lines.length > 0 ? `${flag.path}:${flag.lines.join(", ")}` : `${flag.path} (new)`;

        const sample = flag.sample ? ` \`${flag.sample}\`` : "";
        const must = flag.rule.blocks ? "**must fix** " : "";
        return `- [ ] ${must}**${flag.rule.name}**: ${where}${sample}\n  ${flag.rule.question}`;
      }),
      "",
    ];
  });
}
