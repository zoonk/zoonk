import {
  type AlignmentFile,
  type AlignmentFinding,
  type Capture,
  type CaptureElement,
  configurationName,
} from "./alignment-capture.mts";
import { SCENARIOS, type Scenario } from "./scenarios/scenarios.mts";

/** A layout value's rounding: half a CSS pixel; a whole dp or pt on native. */
const HALF_PIXEL = 0.5;
const WHOLE_UNIT = 1;

function rounding(capture: Capture) {
  return capture.unit === "px" ? HALF_PIXEL : WHOLE_UNIT;
}

function record(
  capture: Capture | null,
  fields: Pick<AlignmentFinding, "detail" | "level" | "message" | "rule"> & { measured?: number },
): AlignmentFinding {
  return {
    configuration: capture ? configurationName(capture.configuration) : "",
    piece: "scenario",
    scenario: capture?.scenario ?? null,
    screen: capture?.screen ?? "",
    unit: capture?.unit,
    ...fields,
  };
}

/**
 * The run against its list: a scenario it was asked for and didn't capture (or whose words never
 * showed) is missing; one the list doesn't name, asked for or captured, isn't measured.
 */
export function reconcile(
  file: AlignmentFile,
  scenarios: Scenario[] = SCENARIOS,
): { findings: AlignmentFinding[]; missing: number | null } {
  if (!file.required) {
    return { findings: [], missing: null };
  }

  const known = new Set(scenarios.map((scenario) => scenario.id));

  const reached = new Set(
    file.captures.flatMap((capture) =>
      capture.scenario && capture.reached !== false ? [capture.scenario] : [],
    ),
  );

  const unknown = [
    ...new Set([...file.required, ...file.captures.flatMap((capture) => capture.scenario ?? [])]),
  ].filter((id) => !known.has(id));

  const missing = file.required.filter((id) => known.has(id) && !reached.has(id));

  return {
    findings: [
      ...missing.map((id) =>
        record(null, {
          detail: id,
          level: "fail",
          message: "a required scenario wasn't captured, or its words never showed",
          rule: "scenario",
        }),
      ),
      ...unknown.map((id) =>
        record(null, {
          detail: id,
          level: "not-measured",
          message: "a scenario the list doesn't name",
          rule: "scenario",
        }),
      ),
    ],
    missing: missing.length,
  };
}

function anchorsOf(capture: Capture) {
  return new Map(
    capture.elements.flatMap((element): [string, CaptureElement][] =>
      element.anchor ? [[element.anchor, element]] : [],
    ),
  );
}

function change(before: CaptureElement, after: CaptureElement) {
  const [x0, y0, w0, h0] = before.bounds;
  const [x1, y1, w1, h1] = after.bounds;
  return { across: x1 - x0, down: y1 - y0, taller: h1 - h0, wider: w1 - w0 };
}

/**
 * Two scenarios of one screen at one configuration: every anchor they name keeps its place and
 * size, except the ones named as the change. A missing or an added anchor is a finding too.
 */
export function pairLeads(
  captures: Capture[],
  scenarios: Scenario[] = SCENARIOS,
): AlignmentFinding[] {
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

  return captures.flatMap((capture) => {
    const scenario = byId.get(capture.scenario ?? "");

    if (!scenario?.pair) {
      return [];
    }

    const { change: changing, with: otherId } = scenario.pair;

    const other = captures.find(
      (candidate) =>
        candidate.scenario === otherId &&
        candidate.screen === capture.screen &&
        configurationName(candidate.configuration) === configurationName(capture.configuration),
    );

    if (!other) {
      return [
        record(capture, {
          detail: `${scenario.id} has no ${otherId} at the same size to compare with`,
          level: "not-measured",
          message: "a state pair's other half wasn't captured",
          rule: "pair",
        }),
      ];
    }

    const before = anchorsOf(other);
    const after = anchorsOf(capture);

    const named = scenario.anchors
      .map((anchor) => anchor.id)
      .filter((id) => !changing.includes(id));

    const tolerance = rounding(capture);

    return named.flatMap((id) => {
      const was = before.get(id);
      const now = after.get(id);

      if (!was || !now) {
        return [
          record(capture, {
            detail: `${id} is ${was ? "missing" : "new"} in ${scenario.id} against ${otherId}`,
            level: "fail",
            message: `an anchor of ${capture.screen} appears or leaves between ${otherId} and ${scenario.id}`,
            rule: "pair",
          }),
        ];
      }

      const moved = change(was, now);
      const most = Math.max(...Object.values(moved).map((value) => Math.abs(value)));

      return most > tolerance
        ? [
            record(capture, {
              detail: `${id}: ${Object.entries(moved)
                .filter(([, value]) => Math.abs(value) > tolerance)
                .map(([way, value]) => `${way} ${Math.round(value * 10) / 10}`)
                .join(", ")}`,
              level: "fail",
              measured: most,
              message: `an anchor of ${capture.screen} moves or resizes between ${otherId} and ${scenario.id}`,
              rule: "pair",
            }),
          ]
        : [];
    });
  });
}
