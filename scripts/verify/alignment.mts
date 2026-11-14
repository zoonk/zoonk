import { type AlignmentFile, type AlignmentFinding, type Capture } from "./alignment-capture.mts";
import { coverageLeads, isOneStack } from "./alignment-coverage.mts";
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

/**
 * One filled action on the active surface; a covering dialog or sheet is its own surface. The same
 * action offered again (the same words to the same destination, such as a page's start link at
 * its top and its end) counts once; actions with no destination each count.
 */
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

  const actions = [
    ...new Map(
      filled.map((action) => [
        action.target ? `${action.text ?? action.name ?? ""} ${action.target}` : action.id,
        action,
      ]),
    ).values(),
  ];

  if (actions.length < 2) {
    return [];
  }

  return [
    finding(context, {
      detail: `${actions.map((action) => action.name ?? action.text ?? action.id).join(", ")} on ${capture.activeSurface}`,
      level: "fail",
      message: "more than one filled action on one surface",
      piece: "action",
      rule: "one-filled",
    }),
  ];
}

function groupLeads(context: Context, group: Group): AlignmentFinding[] {
  const relations = DECLARATIONS.get(group.group.piece);

  if (!relations) {
    return [
      finding(context, {
        detail: group.group.piece,
        level: "not-measured",
        message: "a piece the table doesn't declare",
        piece: group.group.piece,
        rule: "piece",
      }),
    ];
  }

  // Start, end and gap assume one stack of rows; side by side they print as not measured.
  const stacked = isOneStack(group);
  const has = (relation: Relation) => relations.has(relation);
  const one = (relation: Relation) => stacked && has(relation);

  const found = [
    ...coverageLeads(context, group, relations),
    ...(one("label-start")
      ? [...startLeads(context, group, "label"), ...stackedLeads(context, group)]
      : []),
    ...(one("lead-start") ? startLeads(context, group, "lead") : []),
    ...(one("mark-axis") ? axisLeads(context, group) : []),
    ...(one("end-edge") ? endLeads(context, group) : []),
    ...(one("gap") ? gapLeads(context, group) : []),
    ...(has("type") ? typeLeads(context, group) : []),
    ...(has("line") ? lineLeads(context, group) : []),
  ];

  // Rows a platform grouped by the stack holding them, with no piece framing them: leads only.
  return group.group.source === "stack"
    ? found.map((item) => (item.level === "discovery" ? item : { ...item, level: "discovery" }))
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
