import { expect, test } from "vitest";
import { blockedReason } from "./guard-command.mts";

test.each([
  "git add -A",
  "git add --all",
  "git add .",
  "git -C apps/main add .",
  "git add apps/main && git add -A",
  "git commit -am 'fix'",
  "git commit -a -m 'fix'",
  "git stash push -u -m wip",
  "git stash",
  "git commit -m 'fix' --amend",
  "git commit --amend --no-edit",
  "git commit --no-verify -m 'fix'",
  "git push --no-verify",
  "gh pr merge 42 --squash",
])("blocks %s", (command) => {
  expect(blockedReason(command)).not.toBeNull();
});

test.each([
  "git add apps/main/src/page.tsx packages/core/src/plan.ts",
  "git add ./scripts/agents/guard-command.mts",
  "git commit -m 'never use --amend or git stash'",
  'git commit -m "explain why git add -A is gone"',
  "git commit -F - <<'EOF'\nfix: stop using --no-verify\nEOF",
  "git log --grep stash",
  "git commit --allow-empty -m 'ci'",
  "gh pr view 42",
  "pnpm lint",
])("allows %s", (command) => {
  expect(blockedReason(command)).toBeNull();
});
