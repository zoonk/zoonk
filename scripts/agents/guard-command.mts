import { readFileSync } from "node:fs";

const GIT = String.raw`\bgit(?:\s+-C\s+\S+)?\s+`;
const ARGS = String.raw`(?:[^;&|\n]*\s)?`;

const RULES = [
  {
    pattern: new RegExp(String.raw`${GIT}add\s+${ARGS}(?:-A|--all|\.)(?=$|[\s;&|])`, "u"),
    reason:
      "Stage only this change's own paths (`git add <path>…`), so another agent's work in the tree stays out of your commit.",
  },
  {
    pattern: new RegExp(String.raw`${GIT}commit\s+${ARGS}-[a-zA-Z]*a[a-zA-Z]*(?=$|[\s;&|])`, "u"),
    reason: "Stage this change's paths with `git add <path>…`, then commit without `-a`.",
  },
  {
    pattern: new RegExp(String.raw`${GIT}stash\b`, "u"),
    reason:
      "The stash is shared by every worktree on this machine. Set work aside in a WIP commit on your branch instead.",
  },
  {
    pattern: new RegExp(String.raw`${GIT}commit\b[^;&|\n]*--amend\b`, "u"),
    reason: "Add a new commit instead: amending rewrites history other agents may have pulled.",
  },
  {
    pattern: /\bgit\b[^;&|\n]*--no-verify\b/u,
    reason: "Fix what the hook reports instead of skipping it.",
  },
  {
    pattern: /\bgh\s+pr\s+merge\b/u,
    reason: "The user reviews and merges every pull request. Mark it ready and hand it back.",
  },
];

/** Quoted strings and heredoc bodies are data, such as a commit message that names a flag. */
function withoutQuotedText(command: string): string {
  return command
    .replaceAll(/<<-?\s*['"]?(?<tag>\w+)['"]?\n[^]*?\n\s*\k<tag>(?=\n|$)/gu, "")
    .replaceAll(/'[^']*'|"(?:\\.|[^"\\])*"/gu, '""');
}

export function blockedReason(command: string): string | null {
  const code = withoutQuotedText(command);
  return RULES.find(({ pattern }) => pattern.test(code))?.reason ?? null;
}

function readCommand(): string {
  const input: unknown = JSON.parse(readFileSync(0, "utf8"));

  if (typeof input !== "object" || input === null || !("tool_input" in input)) {
    return "";
  }

  const toolInput: unknown = input.tool_input;

  if (typeof toolInput !== "object" || toolInput === null || !("command" in toolInput)) {
    return "";
  }

  return typeof toolInput.command === "string" ? toolInput.command : "";
}

if (import.meta.main) {
  const reason = blockedReason(readCommand());

  if (reason !== null) {
    process.stderr.write(`Blocked by the repository's command rules. ${reason}\n`);
    process.exitCode = 2;
  }
}
