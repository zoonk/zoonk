import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { isClose, issue } from "./_utils/template-helpers";

/** A straight line on the chart: y = intercept + slope × x. */
const lineSchema = z
  .object({ id: idSchema, intercept: z.number(), label: labelSchema, slope: z.number() })
  .strict();

const SHIFT_DIRECTIONS = ["left", "right", "up", "down"] as const;

const lineCrossingFields = z
  .object({
    /** What happened that moved a line, like "Bird flu cut the number of laying hens." */
    change: explanationSchema,
    feedback: z
      .object({ wrongDirection: explanationSchema, wrongLine: explanationSchema })
      .strict(),
    lines: uniqueIdsSchema(lineSchema, { max: 2, min: 2 }),
    shift: z
      .object({
        amount: z.number().positive(),
        direction: z.enum(SHIFT_DIRECTIONS),
        line: idSchema,
      })
      .strict(),
    xLabel: labelSchema,
    yLabel: labelSchema,
  })
  .strict();

type LineCrossingFields = z.output<typeof lineCrossingFields>;
type Line = { intercept: number; slope: number };
type Shift = LineCrossingFields["shift"];

/**
 * A line moved by `amount` in a direction: right means each y now goes with `amount` more x, up
 * means each x now goes with `amount` more y. The player draws shifted lines the same way.
 */
export function shiftLine(line: Line, shift: Pick<Shift, "amount" | "direction">): Line {
  const { amount, direction } = shift;

  if (direction === "up" || direction === "down") {
    return { ...line, intercept: line.intercept + (direction === "up" ? amount : -amount) };
  }

  const offset = direction === "right" ? amount : -amount;
  return { ...line, intercept: line.intercept - line.slope * offset };
}

/** Where two lines cross, or null when they never do. */
export function crossing(first: Line, second: Line): { x: number; y: number } | null {
  if (isClose(first.slope, second.slope)) {
    return null;
  }

  const x = (second.intercept - first.intercept) / (first.slope - second.slope);
  return { x, y: first.intercept + first.slope * x };
}

/** Both lines after the change: the shifted one moved, the other where it was. */
function shiftedLines(fields: LineCrossingFields): Line[] {
  return fields.lines.map((line) =>
    line.id === fields.shift.line ? shiftLine(line, fields.shift) : line,
  );
}

function crossingOf(lines: readonly Line[]) {
  const [first, second] = lines;
  return first && second ? crossing(first, second) : null;
}

function isPositive(point: { x: number; y: number } | null): boolean {
  return point !== null && point.x > 0 && point.y > 0;
}

function lineCrossingIssues(fields: LineCrossingFields) {
  const moving = fields.lines.find((line) => line.id === fields.shift.line);
  const sideways = fields.shift.direction === "left" || fields.shift.direction === "right";

  return [
    !moving &&
      issue("inconsistentFields", "fields.shift.line", "The shifted line isn't one of the lines"),
    moving !== undefined &&
      sideways &&
      moving.slope === 0 &&
      issue(
        "missingInteraction",
        "fields.shift",
        "A flat line doesn't change when it moves sideways",
      ),
    !(isPositive(crossingOf(fields.lines)) && isPositive(crossingOf(shiftedLines(fields)))) &&
      issue(
        "inconsistentFields",
        "fields.lines",
        "The lines must cross at positive x and y, before and after the change",
      ),
  ].filter((item) => item !== false);
}

export const lineCrossingTemplate = defineActivityTemplate({
  checks: ["interaction", "choice", "numeric"],
  description:
    'Two straight lines on one chart and where they cross; the learner drags one line to explain a change and watches the crossing move. Supply and demand (a real price change, like the 2022 egg price spike), cost and revenue (break-even), a budget line, two motions meeting or two equations. Lines are y = intercept + slope × x, each with an id and a label. `shift` is what really happened: which line moves, which way ("left", "right", "up" or "down") and how far. The interaction check expects that line moved that way; the computed number is the new crossing\'s `output` "y" (default) or "x". Fills: the axis labels, both lines, what changed, the shift and feedback for moving the wrong line or the wrong way.',
  expected: (fields) => ({
    curve: fields.shift.line,
    direction: fields.shift.direction,
    kind: "curveShift",
  }),
  fields: lineCrossingFields,
  id: "lineCrossing",
  needsData: true,
  value: (fields, target) => {
    const point = crossingOf(shiftedLines(fields));

    if (!point) {
      return null;
    }

    return target.output === "x" ? point.x : point.y;
  },
  verify: (fields) => lineCrossingIssues(fields),
});
