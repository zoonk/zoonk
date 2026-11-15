import { bleedLeads, spanLeads } from "./alignment-bleed.mts";
import {
  type AlignmentFile,
  type AlignmentFinding,
  type Capture,
  type CaptureElement,
} from "./alignment-capture.mts";
import { coverageLeads, isOneStack } from "./alignment-coverage.mts";
import { axisLeads, endLeads, stackedLeads, startLeads } from "./alignment-edges.mts";
import { evenLeads } from "./alignment-even.mts";
import { gapLeads } from "./alignment-gap.mts";
import {
  type Context,
  type Group,
  drawn,
  finding,
  glyphsOnly,
  groupName,
  groupsOf,
  notMeasured,
  rowName,
} from "./alignment-geometry.mts";
import { lineLeads } from "./alignment-line.mts";
import { pinnedLeads } from "./alignment-pinned.mts";
import { roomLeads } from "./alignment-room.mts";
import { pairLeads, reconcile } from "./alignment-scenarios.mts";
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
    const current = new Set(read.rows.filter((row) => row.current).map((row) => row.id));
    // What a learner sees: a part that draws nothing holds room, and a cut one has its own record.
    const shown = parts.filter(
      (element) => element.part === part && drawn(element) && !glyphsOnly(element),
    );

    const untyped = shown.filter((element) => !element.type || element.type === "not measured");

    // A current row may set its words apart, and a word in a value's place ("Won", "Today") is
    // set in the text face where figures are mono: values compare only where they hold figures.
    const typed = shown.filter(
      (element) =>
        !untyped.includes(element) &&
        !current.has(element.row ?? "") &&
        (part !== "value" || /\d/u.test(element.text ?? "")),
    );

    const unread =
      untyped.length > 0
        ? [
            notMeasured(
              context,
              read,
              "type",
              `a ${part}'s type token wasn't measured`,
              untyped.map((element) => rowName(read, element.row)).join(", "),
            ),
          ]
        : [];

    const tokens = [...Map.groupBy(typed, (element) => element.type ?? "")].toSorted(
      ([, one], [, other]) => other.length - one.length,
    );

    if (tokens.length < 2) {
      return unread;
    }

    const odd = tokens.slice(1).flatMap(([, here]) => here);

    return [
      ...unread,
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

/** An action's words: a keycap hint ("⏎") beside them isn't one. */
function wordsOf(action: CaptureElement) {
  return (action.text ?? action.name ?? "")
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .join(" ");
}

/**
 * One filled action on the active surface; a covering dialog or sheet is its own surface. The same
 * action offered again (the same words and the same `target`: a link's destination, or the action
 * a piece names) counts once; actions with no `target` each count. A marketing page repeats its one
 * action in the same words by rule, so there the same words count once wherever they go.
 */
function filledLeads(context: Context): AlignmentFinding[] {
  const { capture } = context;

  // A gallery shows pieces side by side as samples; it isn't a screen a learner acts on.
  if (capture.specimen) {
    return [];
  }

  if (capture.activeSurface === "not measured") {
    return [
      finding(context, {
        detail: "two surfaces overlap and the page shows no dialog or sheet where they do",
        level: "not-measured",
        message: "which surface is on top wasn't measured",
        piece: "action",
        rule: "one-filled",
      }),
    ];
  }

  const filled = capture.elements.filter(
    (element) =>
      element.part === "action" &&
      element.variant === "filled" &&
      !element.disabled &&
      element.surface === capture.activeSurface,
  );

  return [...Map.groupBy(filled, (action) => action.surface ?? "")].flatMap(([surface, found]) => {
    const actions = [
      ...new Map(
        found.map((action) => {
          if (capture.marketing) {
            return [wordsOf(action), action];
          }

          return [action.target ? `${wordsOf(action)} ${action.target}` : action.id, action];
        }),
      ).values(),
    ];

    if (actions.length < 2) {
      return [];
    }

    return [
      finding(context, {
        detail: `${actions.map((action) => action.name ?? action.text ?? action.id).join(", ")} on ${surface}`,
        level: "fail",
        message: "more than one filled action on one surface",
        piece: "action",
        rule: "one-filled",
      }),
    ];
  });
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

  const scale = group.group.layoutScale;

  if (scale !== undefined) {
    return [
      notMeasured(
        context,
        group,
        "scale",
        "it is drawn at another size than it is laid out (a transform or a zoom)",
        `drawn at ×${scale}`,
      ),
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
    ...(has("room") ? roomLeads(context, group) : []),
    ...(has("even") ? evenLeads(context, group) : []),
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
    // A gallery's specimens each draw in a frame of their own, not on the page's column.
    ...(capture.specimen ? [] : [...bleedLeads(context), ...spanLeads(context)]),
    ...pinnedLeads(context),
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
  const scenarios = reconcile(file);

  // A capture whose scenario never showed is a missing record, not a screen to judge.
  const shown = file.captures.filter((capture) => capture.reached !== false);

  const findings = applyExceptions([
    ...shown.flatMap((capture) => evaluateCapture(capture)),
    ...pairLeads(shown),
    ...scenarios.findings,
    ...(file.discovery ?? []),
  ]);

  return { findings, summary: summarize(findings, scenarios.missing) };
}
