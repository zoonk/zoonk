import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { bindBuild, readCheckoutBuild } from "./provenance.mts";

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

function servedPage(id: string): string {
  return `<script>self.__next_f.push([1,"{\\"d\\":\\"$undefined\\",\\"b\\":\\"${id}\\"}"])</script>`;
}

describe("the build a web picture shows", () => {
  it("finds the checkout's build id where Next.js writes it into the page's HTML", async () => {
    const { repository } = makeBuiltCheckout();
    const checkout = await readCheckoutBuild({ app: "main", repository });
    assert.equal(bindBuild({ checkout, html: servedPage("abc123") }).id, "abc123");
    assert.equal(bindBuild({ checkout, html: servedPage("development") }).id, "unknown");
    assert.equal(bindBuild({ checkout, html: "<p>abc123</p>" }).id, "unknown");
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
    assert.equal(bindBuild({ checkout: outdated, html: '"b":"abc123"' }).id, "unknown");
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
