import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { type CheckResult, checkPictures, formatCheck } from "./check.mts";
import { compareSides, describeChange } from "./compare.mts";
import { SIDES, readCapture, renderMedia } from "./media.mts";

/**
 * Writes `media.md` only when every file it links passes the check, and removes an older one
 * otherwise, so the section on disk is always attachable.
 */
export async function writeSection({ out, repository }: { out: string; repository: string }) {
  const [before, after] = await Promise.all(
    SIDES.map(async (side) => readCapture(join(out, side))),
  );

  const sides = { after, before };
  const changes = await compareSides(out, sides);
  const unchanged = new Set(changes.filter(({ change }) => !change.box).map(({ row }) => row));
  const media = renderMedia({ root: relative(repository, out), sides, unchanged });
  const path = join(out, "media.md");

  const check: CheckResult = await checkPictures({
    manifests: SIDES.map((side) => join(out, side)).filter((folder) => existsSync(folder)),
    pictures: media.attachments.map((file) => resolve(repository, file)),
    repository,
  });

  const written = check.problems.length === 0;

  await (written ? writeFile(path, `${media.markdown}\n`) : rm(path, { force: true }));

  const lines = [
    ...(changes.length > 0
      ? ["What changed in each pair:", ...changes.map((change) => `  ${describeChange(change)}`)]
      : []),
    formatCheck(check, out),
    written
      ? [
          `Before-and-after section: ${relative(repository, path)}${before && after ? "" : " (one side so far)"}`,
          "Rewrite each panel's summary to say what changed there. Put the section in the PR body, and pass every file it links to gh pr create or gh pr edit, run from the repository root:",
          media.attachments.map((file) => `--attach ${file}`).join(" "),
        ].join("\n")
      : "No media.md until the check passes.",
  ];

  return { report: lines.join("\n"), written };
}
