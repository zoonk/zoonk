import { type AlignmentFile, type AlignmentFinding, type Capture } from "./alignment-capture.mts";
import { axisLeads, endLeads, gapLeads, stackedLeads, startLeads } from "./alignment-edges.mts";
import {
  type Context,
  type Group,
  finding,
  groupName,
  groupsOf,
  rowName,
} from "./alignment-geometry.mts";
import { lineLeads } from "./alignment-line.mts";
import { type Summary, summarize } from "./alignment-summary.mts";
import {
  type AlignmentException,
  DECLARATIONS,
  EXCEPTIONS,
  type Relation,
} from "./alignment-table.mts";

/**
 * The one evaluator of the declared relationships. It reads captures, from the web page or from the
 * Android and Apple captures (`REPORT-SHAPE.md`), and never the page itself, so every platform is
 * judged by the same rules.
 */

/** Every part of one role in a group uses one type token. */
function typeLeads(context: Context, read: Group): AlignmentFinding[] {
  const { group, parts } = read;

  return (["label", "lead", "note", "value"] as const).flatMap((part) => {
    const typed = parts.filter(
      (element) => element.part === part && element.type && element.type !== "not measured",
    );

    const tokens = [...Map.groupBy(typed, (element) => element.type ?? "")].toSorted(
      ([, one], [, other]) => other.length - one.length,
    );

    if (tokens.length < 2) {
      return [];
    }

    const odd = tokens.slice(1).flatMap(([, here]) => here);

    return [
      finding(context, {
        detail: `${tokens.map(([token, here]) => `${token} ×${here.length}`).join(", ")}; the odd ones: ${odd.map((element) => rowName(read, element.row)).join(", ")}`,
        level: "fail",
        message: `the ${part}s of ${groupName(read)} use ${tokens.length} type tokens`,
        piece: group.piece,
        rule: "type",
      }),
    ];
  });
}

/** At most one filled action on the active surface; a covering dialog or sheet is its own. */
function filledLeads(context: Context): AlignmentFinding[] {
  const { capture } = context;

  // A gallery shows pieces side by side as samples; it isn't a screen a learner acts on.
  if (capture.specimen) {
    return [];
  }

  const filled = capture.elements.filter(
    (element) =>
      element.part === "action" &&
      element.variant === "filled" &&
      element.surface === capture.activeSurface,
  );

  if (filled.length < 2) {
    return [];
  }

  return [
    finding(context, {
      detail: `${filled.map((action) => action.name ?? action.text ?? action.id).join(", ")} on ${capture.activeSurface}`,
      level: "fail",
      message: "more than one filled action on one surface",
      piece: "action",
      rule: "one-filled",
    }),
  ];
}

function groupLeads(context: Context, group: Group): AlignmentFinding[] {
  const relations = DECLARATIONS.get(group.group.piece) ?? new Set<string>();
  const has = (relation: Relation) => relations.has(relation);

  const found = [
    ...(has("label-start")
      ? [...startLeads(context, group, "label"), ...stackedLeads(context, group)]
      : []),
    ...(has("lead-start") ? startLeads(context, group, "lead") : []),
    ...(has("mark-axis") ? axisLeads(context, group) : []),
    ...(has("end-edge") ? endLeads(context, group) : []),
    ...(has("gap") ? gapLeads(context, group) : []),
    ...(has("type") ? typeLeads(context, group) : []),
    ...(has("line") ? lineLeads(context, group) : []),
  ];

  // Rows a platform grouped by the stack holding them, with no piece framing them: a lead.
  return group.group.source === "stack"
    ? found.map((item) => (item.level === "fail" ? { ...item, level: "discovery" } : item))
    : found;
}

export function evaluateCapture(capture: Capture): AlignmentFinding[] {
  const context = { capture, unit: capture.unit };

  return [
    ...groupsOf(capture).flatMap((group) => groupLeads(context, group)),
    ...filledLeads(context),
  ];
}

function excepted(item: AlignmentFinding, exceptions: AlignmentException[]) {
  return exceptions.find(
    (exception) =>
      exception.relation === item.rule &&
      exception.piece === item.piece &&
      exception.scenario === (item.scenario ?? item.screen) &&
      exception.configuration === item.configuration,
  );
}

export function applyExceptions(
  findings: AlignmentFinding[],
  exceptions: AlignmentException[] = EXCEPTIONS,
): AlignmentFinding[] {
  return findings.map((item) => {
    const exception = item.level === "fail" ? excepted(item, exceptions) : undefined;
    return exception ? { ...item, exception: exception.reason } : item;
  });
}

export function evaluateFile(file: AlignmentFile): {
  findings: AlignmentFinding[];
  summary: Summary;
} {
  const findings = applyExceptions([
    ...file.captures.flatMap((capture) => evaluateCapture(capture)),
    ...(file.discovery ?? []),
  ]);

  return { findings, summary: summarize(findings) };
}
