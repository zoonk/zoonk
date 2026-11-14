import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { type Build } from "./media.mts";

const run = promisify(execFile);

/** A whole diff of the app and packages, binary files included, can run to many megabytes. */
const MAX_GIT_OUTPUT = 268_435_456;

async function git(repository: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, {
    cwd: repository,
    encoding: "utf8",
    maxBuffer: MAX_GIT_OUTPUT,
  });

  return stdout.trim();
}

export async function sha256File(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function commitIncludes({
  ancestor,
  commit,
  repository,
}: {
  ancestor: string;
  commit: string;
  repository: string;
}): Promise<boolean> {
  return run("git", ["merge-base", "--is-ancestor", ancestor, commit], { cwd: repository }).then(
    () => true,
    () => false,
  );
}

/**
 * The newest commit on HEAD after `commit` that touched `paths`, as "<short sha> <subject>"; a
 * commit HEAD doesn't contain (rebased away, another branch) counts as outdated by HEAD itself.
 */
export async function latestCommitSince({
  commit,
  paths,
  repository,
}: {
  commit: string;
  paths: string[];
  repository: string;
}): Promise<string | undefined> {
  if (!(await commitIncludes({ ancestor: commit, commit: "HEAD", repository }))) {
    const head = await git(repository, ["log", "-1", "--format=%h %s", "HEAD"]);
    return `${commit.slice(0, 10)} is not in this branch's history; HEAD is ${head}`;
  }

  const latest = await git(repository, [
    "log",
    "-1",
    "--format=%h %s",
    `${commit}..HEAD`,
    "--",
    ...paths,
  ]);

  return latest || undefined;
}

async function uncommittedChanges({
  paths,
  repository,
}: {
  paths: string[];
  repository: string;
}): Promise<string | undefined> {
  const [diff, untracked] = await Promise.all([
    git(repository, ["diff", "HEAD", "--binary", "--", ...paths]),
    git(repository, ["ls-files", "--others", "--exclude-standard", "--", ...paths]),
  ]);

  if (!diff && !untracked) {
    return undefined;
  }

  const files = untracked ? untracked.split("\n") : [];

  const contents = await Promise.all(
    files.map(async (file) => `${file}\n${await sha256File(join(repository, file))}`),
  );

  return sha256Text([diff, ...contents].join("\n"));
}

/** Like make: a build is current when no source file under `paths` changed after it. */
async function builtAfterSources({
  builtAt,
  paths,
  repository,
}: {
  builtAt: number;
  paths: string[];
  repository: string;
}): Promise<boolean> {
  const files = await git(repository, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ...paths,
  ]);

  const times = await Promise.all(
    files
      .split("\n")
      .filter(Boolean)
      .map(async (file) =>
        stat(join(repository, file)).then(
          (stats) => stats.mtimeMs,
          () => 0,
        ),
      ),
  );

  return times.every((time) => time <= builtAt);
}

export type CheckoutBuild = Omit<Build, "id"> & { current?: string };

/**
 * `current` is the build id `next build` wrote to the app's `.next`, when that build is newer
 * than every source file of the app and the shared packages.
 */
export async function readCheckoutBuild({
  app,
  repository,
}: {
  app: string;
  repository: string;
}): Promise<CheckoutBuild> {
  const paths = [`apps/${app}`, "packages"];
  const buildIdFile = join(repository, "apps", app, ".next", "BUILD_ID");

  const [commit, changes] = await Promise.all([
    git(repository, ["rev-parse", "HEAD"]),
    uncommittedChanges({ paths, repository }),
  ]);

  if (!existsSync(buildIdFile)) {
    return { app, changes, commit };
  }

  const [id, { mtimeMs }] = await Promise.all([readFile(buildIdFile, "utf8"), stat(buildIdFile)]);
  const fresh = await builtAfterSources({ builtAt: mtimeMs, paths, repository });

  return { app, changes, commit, current: fresh ? id.trim() : undefined };
}

/**
 * Next.js writes the build id into each page's payload as `"b"` when no deployment id is set, as on
 * a local `next start` (`next dev` writes "development"). In the HTML it sits in an escaped string.
 */
export function bindBuild({ checkout, html }: { checkout: CheckoutBuild; html: string }): Build {
  const { current, ...build } = checkout;

  const served =
    current !== undefined &&
    (html.includes(`\\"b\\":\\"${current}\\"`) || html.includes(`"b":"${current}"`));

  return { ...build, id: served ? current : "unknown" };
}

export async function resolveCommit({
  repository,
  revision,
}: {
  repository: string;
  revision: string;
}): Promise<string> {
  return git(repository, ["rev-parse", "--verify", "--quiet", `${revision}^{commit}`]).catch(
    (error: unknown) => {
      throw new Error(`${revision} is not a commit in this repository.`, { cause: error });
    },
  );
}
