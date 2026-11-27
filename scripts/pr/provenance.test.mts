import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "vitest";
import { bindBuild, readCheckoutBuild, servedBuildId } from "./provenance.mts";

const MINUTE = 60_000;

/** The repository's own file marking what never reaches a screen. */
const ATTRIBUTES = resolve(import.meta.dirname, "../../.gitattributes");

/** When the sources were written and committed: the test's own time, never the real clock's. */
const WRITTEN = Date.parse("2026-01-01T12:00:00.000Z");

function git(repository: string, ...args: string[]) {
  const date = `${WRITTEN / 1000} +0000`;

  execFileSync("git", args, {
    cwd: repository,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
}

function makeBuiltCheckout() {
  const repository = mkdtempSync(join(tmpdir(), "pr-media-build-"));
  git(repository, "init", "-q");
  git(repository, "config", "user.email", "agent@example.com");
  git(repository, "config", "user.name", "Agent");
  mkdirSync(join(repository, "apps/main/.next"), { recursive: true });
  mkdirSync(join(repository, "packages/ui"), { recursive: true });
  writeFileSync(join(repository, ".gitignore"), ".next\n");
  copyFileSync(ATTRIBUTES, join(repository, ".gitattributes"));
  writeFileSync(join(repository, "apps/main/page.txt"), "page");
  writeFileSync(join(repository, "packages/ui/row.txt"), "row");
  const written = new Date(WRITTEN);
  const sources = [".gitignore", ".gitattributes", "apps/main/page.txt", "packages/ui/row.txt"];

  for (const source of sources) {
    utimesSync(join(repository, source), written, written);
  }

  git(repository, "add", ".");
  git(repository, "commit", "-qm", "start");

  const buildId = join(repository, "apps/main/.next/BUILD_ID");
  writeFileSync(buildId, "abc123\n");
  const built = new Date(WRITTEN + MINUTE);
  utimesSync(buildId, built, built);
  return { built, repository };
}

/** How `next start` sends a page: its payload rows in escaped strings, row 0 carrying the build. */
function servedPage(rows: string[]): string {
  return rows
    .map((row) => `<script>self.__next_f.push([1,${JSON.stringify(row)}])</script>`)
    .join("");
}

describe("the build a web picture shows", () => {
  it("reads the build id only from the payload's root row, even split across scripts", () => {
    const root = '0:{"P":null,"c":["","en","pricing"],"b":"abc123","u":"$@24"}\n';

    assert.equal(servedBuildId(servedPage([root])), "abc123");
    const half = Math.floor(root.length / 2);

    assert.equal(servedBuildId(servedPage([root.slice(0, half), root.slice(half)])), "abc123");
  });

  it("calls the build unknown when only the page's text names it, or the payload says development", async () => {
    const { repository } = makeBuiltCheckout();
    const checkout = await readCheckoutBuild({ app: "main", repository });
    const spoof = `<pre>{"b":"abc123"}</pre>${servedPage(['0:{"P":null,"b":"development"}\n'])}`;

    assert.equal(
      bindBuild({ checkout, html: servedPage(['0:{"P":null,"b":"abc123"}\n']) }).id,
      "abc123",
    );

    assert.equal(bindBuild({ checkout, html: spoof }).id, "unknown");
    assert.equal(bindBuild({ checkout, html: '<p>0:{"b":"abc123"}</p>' }).id, "unknown");
  });

  it("binds the served build only when it is this checkout's build, newer than its sources", async () => {
    const { built, repository } = makeBuiltCheckout();
    const checkout = await readCheckoutBuild({ app: "main", repository });

    assert.equal(checkout.current, "abc123");
    assert.equal(checkout.changes, undefined);

    const later = new Date(built.getTime() + MINUTE);
    utimesSync(join(repository, "packages/ui/row.txt"), later, later);
    const outdated = await readCheckoutBuild({ app: "main", repository });

    assert.equal(outdated.current, undefined);

    assert.equal(
      bindBuild({ checkout: outdated, html: servedPage(['0:{"P":null,"b":"abc123"}\n']) }).id,
      "unknown",
    );
  });

  it("digests uncommitted changes to the app and packages, and only those", async () => {
    const { repository } = makeBuiltCheckout();
    writeFileSync(join(repository, "notes.md"), "unrelated");

    const clean = await readCheckoutBuild({ app: "main", repository });

    assert.equal(clean.changes, undefined);

    writeFileSync(join(repository, "apps/main/new.txt"), "draft");
    const first = await readCheckoutBuild({ app: "main", repository });
    writeFileSync(join(repository, "apps/main/new.txt"), "another draft");
    const second = await readCheckoutBuild({ app: "main", repository });

    assert.match(first.changes ?? "", /^[0-9a-f]{64}$/u);
    assert.notEqual(first.changes, second.changes);
  });

  it("keeps the build current and clean while only tests change", async () => {
    const { built, repository } = makeBuiltCheckout();
    const later = new Date(built.getTime() + MINUTE);

    for (const test of ["apps/main/e2e/plan.test.ts", "packages/ui/row.test.tsx"]) {
      mkdirSync(join(repository, test, ".."), { recursive: true });
      writeFileSync(join(repository, test), "a test");
      utimesSync(join(repository, test), later, later);
    }

    const checkout = await readCheckoutBuild({ app: "main", repository });

    assert.equal(checkout.changes, undefined);
    assert.equal(checkout.current, "abc123");
    appendFileSync(join(repository, ".gitattributes"), "apps/main/page.txt never-on-screen\n");
    const remarked = await readCheckoutBuild({ app: "main", repository });

    assert.match(remarked.changes ?? "", /^[0-9a-f]{64}$/u);
  });
});
