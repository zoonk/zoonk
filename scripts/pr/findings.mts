import { resolve } from "node:path";
import { literal } from "./device-section.mts";
import { findManifests } from "./locate.mts";
import {
  type Finding,
  type FindingState,
  type ManifestItem,
  type Read,
  blocks,
  pathWithin,
  readManifest,
  readOf,
  writeManifest,
} from "./media.mts";

/** The read that holds a picture's findings: its own, or, until a retake is read, the one it kept. */
function heldBy(item: ManifestItem): Read | undefined {
  return readOf(item) ?? ("retakes" in item ? item.retakes?.read : undefined);
}

function closeIn(item: ManifestItem, close: (finding: Finding) => Finding): ManifestItem {
  const read = readOf(item);

  if (read) {
    return { ...item, read: { ...read, findings: read.findings.map(close) } };
  }

  if (!("retakes" in item) || !item.retakes) {
    return item;
  }

  const kept = item.retakes.read;

  return {
    ...item,
    retakes: { ...item.retakes, read: { ...kept, findings: kept.findings.map(close) } },
  };
}

/**
 * Closes the finding `id` on every picture under `root` that holds it. One the PR must fix never
 * goes to an issue: it closes fixed, or by an exception the user granted.
 */
export async function resolveFinding({
  id,
  root,
  state,
}: {
  id: string;
  root: string;
  state: FindingState;
}): Promise<void> {
  const folders = await findManifests(root);

  const manifests = await Promise.all(
    folders.map(async (folder) => ({ folder, items: (await readManifest(folder)) ?? [] })),
  );

  const holding = manifests.filter(({ items }) =>
    items.some((item) => heldBy(item)?.findings.some((finding) => finding.id === id)),
  );

  const found = holding
    .flatMap(({ items }) => items.flatMap((item) => heldBy(item)?.findings ?? []))
    .find((finding) => finding.id === id);

  if (!found) {
    throw new Error(`No finding ${id} under ${root}.`);
  }

  if (state.state === "issue" && blocks(found)) {
    throw new Error(
      `${id} is one this PR must fix: it misleads a learner, or the PR broke rule ${found.rule}. Fix it and resolve it with --fixed <commit>, or --exception "<who granted it>" when the user granted one.`,
    );
  }

  const close = (finding: Finding): Finding =>
    finding.id === id ? { ...finding, ...state } : finding;

  await Promise.all(
    holding.map(async ({ folder, items }) =>
      writeManifest(
        folder,
        items.map((item) => closeIn(item, close)),
      ),
    ),
  );
}

function closedHow(finding: Finding): string | undefined {
  if (finding.state === "issue") {
    return `Filed in #${finding.issue}`;
  }

  if (finding.state === "not-a-fault") {
    return `Not a fault: ${literal(finding.reason)}`;
  }

  return finding.state === "exception"
    ? `Exception granted by ${literal(finding.grantedBy)}`
    : undefined;
}

/**
 * The PR body's list of every finding under `root` that closed without a fix, once each with the
 * pictures that show it, so the user accepts or overrules each one.
 */
export async function closedSection(root: string): Promise<string> {
  const folders = await findManifests(root);

  const shown = await Promise.all(
    folders.map(async (folder) =>
      ((await readManifest(folder)) ?? []).flatMap((item) =>
        (heldBy(item)?.findings ?? []).map((finding) => ({
          finding,
          picture: pathWithin(root, resolve(folder, item.file)),
        })),
      ),
    ),
  );

  const rows = [...Map.groupBy(shown.flat(), ({ finding }) => finding.id).values()].flatMap(
    (list) => {
      const finding = list[0]?.finding;
      const how = finding && closedHow(finding);
      const pictures = list.map(({ picture }) => `\`${picture}\``).join(", ");
      return finding && how ? [`| ${literal(finding.text)} | ${pictures} | ${how} |`] : [];
    },
  );

  if (rows.length === 0) {
    return "No finding closed without a fix.";
  }

  return [
    "## Findings closed without a fix",
    "",
    "| Finding | Pictures | Closed |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}
