/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type AlignmentFinding, type Capture, type CaptureElement } from "./alignment-capture.mts";
import { evaluateCapture } from "./alignment.mts";

/** The alignment tests' fixtures. Captures read from real pages, each fault's commit reversed in the working tree, then fixed. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The tooling's own fixture.
const CASES = JSON.parse(
  readFileSync(join(import.meta.dirname, "alignment-cases.json"), "utf8"),
) as Record<string, Capture>;

export function real(name: string): Capture {
  const capture = CASES[name];
  assert.ok(capture, name);
  return capture;
}

export function failures(capture: Capture): AlignmentFinding[] {
  return evaluateCapture(capture).filter((finding) => finding.level === "fail");
}

export function fixtureCapture(elements: CaptureElement[], activeSurface = "page"): Capture {
  return {
    activeSurface,
    configuration: {
      height: 844,
      locale: "en",
      pointer: "touch",
      scheme: "light",
      size: "phone",
      textScale: 1,
      width: 390,
    },
    elements,
    platform: "android",
    scale: 3,
    scenario: "fixture",
    screen: "fixture",
    unit: "dp",
    version: 1,
  };
}

export function element(fields: Partial<CaptureElement> & Pick<CaptureElement, "id" | "part">) {
  return {
    bounds: [0, 0, 10, 10],
    group: "g",
    ink: [0, 0, 10, 10],
    piece: "list-group",
    row: null,
    ...fields,
  } satisfies CaptureElement;
}

export const LABEL_TYPE = "Geist 14px 500 20px";

/** Stacked rows 44 apart, each with a measured label, so a fixture judges only what it sets up. */
export function labelledRows(count: number) {
  return Array.from({ length: count }, (_, index) => [
    element({ bounds: [0, index * 44, 358, 44], endEdge: 358, id: `r${index}`, part: "row" }),
    element({
      id: `t${index}`,
      ink: [28, index * 44 + 12, 100, 20],
      part: "label",
      row: `r${index}`,
      type: LABEL_TYPE,
    }),
  ]).flat();
}

export function filledActions(surface: string, count: number) {
  return Array.from({ length: count }, (_, index) =>
    element({
      group: null,
      id: `${surface}${index}`,
      part: "action",
      piece: "action",
      surface,
      variant: "filled",
    }),
  );
}

/** Two rows whose values sit before their chevrons, and a third whose value ends at `lastValueEnd`. */
export function valueList(lastValueEnd: number) {
  return fixtureCapture([
    element({ endEdge: 358, group: null, id: "g", part: "group" }),
    ...labelledRows(3),
    element({ id: "v0", ink: [300, 14, 30, 16], part: "value", row: "r0" }),
    element({ id: "e0", ink: [352, 15, 6, 14], part: "end", row: "r0" }),
    element({ id: "v1", ink: [300, 58, 30, 16], part: "value", row: "r1" }),
    element({ id: "e1", ink: [352, 59, 6, 14], part: "end", row: "r1" }),
    element({ id: "v2", ink: [lastValueEnd - 30, 102, 30, 16], part: "value", row: "r2" }),
  ]);
}

export function endFindings(capture: Capture) {
  return evaluateCapture(capture).filter((finding) => finding.rule === "end-edge");
}
