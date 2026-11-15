import { relative } from "node:path";
import { isRemote } from "./locate.mts";

/** In the order they print: what can't be bound first, then what a retake fixes, then the read. */
const KINDS = [
  {
    kind: "unsupported",
    label:
      "Media or a reference-style definition the check can't read: write each picture as ![description](path) and each link inline as [text](url)",
    summary: "in a form the check can't read",
  },
  {
    kind: "missing",
    label:
      "Not found: fix the path, or, for picture syntax shown as an example in code, leave out the !",
    summary: "not found",
  },
  {
    kind: "remote",
    label: "Not a local file: check the body before uploading",
    summary: "not local",
  },
  {
    kind: "changed",
    label: "Changed since its capture: its bytes don't match its manifest",
    summary: "changed since capture",
  },
  {
    kind: "unrecorded",
    label: "Not in any capture manifest: take it with pnpm pr:capture",
    summary: "not in any capture manifest",
  },
  { kind: "pending", label: "Pending: no native capture record yet", summary: "pending" },
  {
    kind: "unknown-build",
    label: "After picture from an unknown build: serve this checkout with pnpm start and retake",
    summary: "from an unknown build",
  },
  {
    kind: "uncommitted",
    label: "After picture built with uncommitted changes: commit, rebuild and retake",
    summary: "built with uncommitted changes",
  },
  {
    kind: "stale",
    label: "After picture older than a later commit to its app or the shared packages: retake",
    summary: "stale",
  },
  {
    kind: "unread",
    label: "No read recorded: run pnpm pr:media tiles, read, then pnpm pr:media read",
    summary: "with no read",
  },
  { kind: "finding", label: "Unresolved finding from the read", summary: "unresolved findings" },
  {
    kind: "fixed-not-retaken",
    label: "Finding fixed after the picture was taken: retake",
    summary: "fixed but not retaken",
  },
  {
    kind: "alignment",
    label: "Layout the capture's alignment.json fails or couldn't measure",
    summary: "layout findings failing or not measured",
  },
  {
    kind: "scenarios",
    label: "Required scenarios the capture's alignment.json says are missing",
    summary: "captures missing scenarios",
  },
] as const;

type Kind = (typeof KINDS)[number]["kind"];

export type Problem = { detail?: string; kind: Kind; picture?: string };

type Reads = { carried: number; missing: number; new: number };

/**
 * `notMeasured` counts the after captures with no alignment report, or one that measured nothing;
 * `nothingDeclared`, the screens measured that hold no declared piece, drawn box or action.
 */
export type CheckResult = {
  checked: number;
  /** After pictures from an emulator or a simulator: no capture, so only their read checks layout. */
  devicePictures?: number;
  nothingDeclared?: number;
  notMeasured: number;
  problems: Problem[];
  reads: Reads;
};

function kindOf(kind: Kind) {
  const index = KINDS.findIndex((entry) => entry.kind === kind);
  const { label, summary } = KINDS[index] ?? { label: kind, summary: kind };
  return { index, label, summary };
}

export function formatCheck(
  { checked, devicePictures = 0, nothingDeclared = 0, notMeasured, problems, reads }: CheckResult,
  root: string,
): string {
  if (checked === 0 && problems.length === 0) {
    return "NO PICTURES: the body links none, so nothing was checked";
  }

  const groups = [...Map.groupBy(problems, (problem) => problem.kind)].toSorted(
    ([first], [second]) => kindOf(first).index - kindOf(second).index,
  );

  const shown = (picture: string) => (isRemote(picture) ? picture : relative(root, picture));

  const lines = groups.flatMap(([kind, list]) => [
    `${kindOf(kind).label} (${list.length})`,
    ...list.map(({ detail, picture }) =>
      picture ? `  ${shown(picture)}${detail ? `: ${detail}` : ""}` : `  ${detail}`,
    ),
  ]);

  const unmeasured =
    notMeasured > 0
      ? `; layout not measured for ${notMeasured} ${notMeasured === 1 ? "capture" : "captures"}`
      : "";

  const undeclared =
    nothingDeclared > 0
      ? `; layout measured with nothing declared on ${nothingDeclared} ${nothingDeclared === 1 ? "screen" : "screens"}`
      : "";

  const devices =
    devicePictures > 0
      ? `; ${devicePictures} device ${devicePictures === 1 ? "picture" : "pictures"}: layout not measured, ${devicePictures === 1 ? "its read checks it" : "their reads check it"}`
      : "";

  const summary =
    groups.length === 0
      ? `PASS: ${checked} pictures, each in a capture manifest; every after picture from a current, committed build and read${unmeasured}${undeclared}${devices}`
      : `FAIL: ${groups.map(([kind, list]) => `${list.length} ${kindOf(kind).summary}`).join("; ")}, of ${checked} pictures${unmeasured}${undeclared}${devices}`;

  const readLine =
    reads.carried + reads.new + reads.missing > 0 &&
    `Reads: ${reads.carried} carried over from a capture with the same pixels, ${reads.new} new, ${reads.missing} still to read`;

  return [...lines, readLine, summary].filter(Boolean).join("\n");
}
