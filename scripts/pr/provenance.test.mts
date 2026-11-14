import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { bindBuild, readCheckoutBuild, servedBuildId } from "./provenance.mts";

const MINUTE = 60_000;

function git(repository: string, ...args: string[]) {
  execFileSync("git", args, { cwd: repository });
}

function makeBuiltCheckout() {
  const repository = mkdtempSync(join(tmpdir(), "pr-media-build-"));
  git(repository, "init", "-q");
  git(repository, "config", "user.email", "agent@example.com");
  git(repository, "config", "user.name", "Agent");
  mkdirSync(join(repository, "apps/main/.next"), { recursive: true });
  mkdirSync(join(repository, "packages/ui"), { recursive: true });
  writeFileSync(join(repository, ".gitignore"), ".next\n");
  writeFileSync(join(repository, "apps/main/page.txt"), "page");
  writeFileSync(join(repository, "packages/ui/row.txt"), "row");
  git(repository, "add", ".");
  git(repository, "commit", "-qm", "start");

  const buildId = join(repository, "apps/main/.next/BUILD_ID");
  writeFileSync(buildId, "abc123\n");
  const built = new Date(Date.now() + MINUTE);
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
});
