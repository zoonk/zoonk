import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { duplicateIssues, isClose, issue } from "./_utils/template-helpers";

const MAX_POINTS = 6;
const MIN_POINTS = 3;
const MIN_AREA = 1e-6;
const HALF_TURN_DEGREES = 180;
const TRIANGLE_POINTS = 3;
const TANGENT_LIMIT = 1e-9;
const RIGHT_ANGLE_SLACK = 1e-6;
const FULL_TURN_DEGREES = 360;
/** Radians written to a few digits, like 6.2832 for a full turn, still count as one turn. */
const TURN_SLACK = 1e-3;

const pointSchema = z
  .object({
    id: idSchema,
    label: labelSchema.optional(),
    movable: z.boolean(),
    /** A moving corner that slides along one line instead of anywhere, to keep something true. */
    track: z.enum(["horizontal", "vertical"]).optional(),
    x: z.number(),
    y: z.number(),
  })
  .strict();

type Point = z.output<typeof pointSchema>;
type Track = NonNullable<Point["track"]>;

function edges(points: readonly Point[]): [Point, Point][] {
  return points.flatMap((point, index): [Point, Point][] => {
    const next = points[(index + 1) % points.length];
    return next ? [[point, next]] : [];
  });
}

function edgeLength([from, to]: [Point, Point]): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/** Shoelace formula: the polygon's area from its corners, in order. */
function polygonArea(points: readonly Point[]): number {
  return (
    Math.abs(edges(points).reduce((sum, [from, to]) => sum + from.x * to.y - to.x * from.y, 0)) / 2
  );
}

/** Squares of the three sides, longest last, for the Pythagoras board. */
function sortedSquares(points: readonly Point[]): number[] {
  return edges(points)
    .map((edge) => edgeLength(edge) ** 2)
    .toSorted((a, b) => a - b);
}

function neighbours(points: readonly Point[], index: number): [Point, Point] | null {
  const previous = points[(index - 1 + points.length) % points.length];
  const next = points[(index + 1) % points.length];

  return previous && next ? [previous, next] : null;
}

/** Whether two points sit on one line in the track's direction, the line a corner slides on. */
function isAlong(track: Track, from: Point, to: Point): boolean {
  return track === "horizontal"
    ? isClose(from.y, to.y, RIGHT_ANGLE_SLACK)
    : isClose(from.x, to.x, RIGHT_ANGLE_SLACK);
}

/**
 * A corner sliding parallel to the line through its two fixed neighbours keeps the triangle they
 * make, and so the polygon's area, the same: same base, same height.
 */
function keepsArea(points: readonly Point[]): boolean {
  return points.every((point, index) => {
    const pair = neighbours(points, index);

    if (!point.movable) {
      return true;
    }

    return (
      pair !== null &&
      point.track !== undefined &&
      pair.every((neighbour) => !neighbour.movable) &&
      isAlong(point.track, ...pair)
    );
  });
}

function isRightCorner(points: readonly Point[], index: number): boolean {
  const corner = points[index];
  const pair = neighbours(points, index);

  if (!corner || !pair) {
    return false;
  }

  const [first, second] = pair;

  const dot =
    (first.x - corner.x) * (second.x - corner.x) + (first.y - corner.y) * (second.y - corner.y);

  const scale = edgeLength([corner, first]) * edgeLength([corner, second]);

  return Math.abs(dot) <= RIGHT_ANGLE_SLACK * Math.max(1, scale);
}

/**
 * a² + b² = c² only holds while the triangle stays right: the right-angle corner stays put and
 * every other moving corner slides along its own side.
 */
function keepsRightAngle(points: readonly Point[]): boolean {
  const corner = points.find((_, index) => isRightCorner(points, index));

  return (
    corner !== undefined &&
    !corner.movable &&
    points.every(
      (point) =>
        point === corner ||
        !point.movable ||
        (point.track !== undefined && isAlong(point.track, point, corner)),
    )
  );
}

const geometryBoardFields = z
  .object({
    invariant: explanationSchema,
    measure: z.enum(["angleSum", "area", "perimeter", "pythagoras"]),
    points: uniqueIdsSchema(pointSchema, { max: MAX_POINTS, min: MIN_POINTS }),
  })
  .strict();

type GeometryBoardFields = z.output<typeof geometryBoardFields>;

/**
 * The number a check can ask for: only a measure that never changes as the learner drags, so the
 * answer is the same wherever the corners end up. The angle sum always qualifies; the area does
 * when every moving corner slides parallel to its fixed neighbours.
 */
function invariantMeasure(fields: GeometryBoardFields): number | null {
  if (fields.measure === "angleSum") {
    return (fields.points.length - 2) * HALF_TURN_DEGREES;
  }

  return fields.measure === "area" && keepsArea(fields.points) ? polygonArea(fields.points) : null;
}

function isRightTriangle(points: readonly Point[]): boolean {
  const [first = 0, second = 0, longest = 0] = sortedSquares(points);
  return points.length === TRIANGLE_POINTS && isClose(first + second, longest, RIGHT_ANGLE_SLACK);
}

function pythagorasIssues(points: readonly Point[]) {
  if (!isRightTriangle(points)) {
    return [issue("inconsistentFields", "fields.points", "Pythagoras needs a right triangle")];
  }

  return keepsRightAngle(points)
    ? []
    : [
        issue(
          "inconsistentFields",
          "fields.points",
          "Keep the right angle as corners move: its corner stays fixed and each moving corner slides along its side with a track",
        ),
      ];
}

export const geometryBoardTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "Drag the corners of a shape and watch what always stays true: the angles add up to the same total, a² + b² = c² with a square on each side of a right triangle (its right-angle corner stays fixed and the other corners slide along their sides with `track`), or the area when a corner slides parallel to the line through its fixed neighbours. Code draws the angles, lengths, squares and area as the corners move. A numeric check, or options with values, needs a number that never changes: the angle sum, or that fixed area. Fills: the points, which ones move and along which track, what to measure, what always stays true and the check question.",
  fields: geometryBoardFields,
  id: "geometryBoard",
  needsData: false,
  value: (fields) => invariantMeasure(fields),
  verify: (fields) =>
    [
      !fields.points.some((point) => point.movable) &&
        issue("missingInteraction", "fields.points", "No point can be moved"),
      fields.points.some((point) => point.track !== undefined && !point.movable) &&
        issue("inconsistentFields", "fields.points", "Only a corner that moves can have a track"),
      polygonArea(fields.points) < MIN_AREA &&
        issue("inconsistentFields", "fields.points", "The points don't make a shape"),
      ...(fields.measure === "pythagoras" ? pythagorasIssues(fields.points) : []),
    ].filter((item) => item !== false),
});

const trigFunctions = { cos: Math.cos, sin: Math.sin, tan: Math.tan } as const;
const trigNames = ["cos", "sin", "tan"] as const;

const unitCircleFields = z
  .object({
    angleUnit: z.enum(["degrees", "radians"]),
    frame: explanationSchema,
    show: z.array(z.enum(trigNames)).min(1).max(trigNames.length),
    startAngle: z.number(),
  })
  .strict();

type UnitCircleFields = z.output<typeof unitCircleFields>;

/** The learner turns the point once around, so reachable angles are one turn from zero. */
function isWithinTurn(fields: UnitCircleFields, angle: number): boolean {
  const turn = fields.angleUnit === "degrees" ? FULL_TURN_DEGREES : 2 * Math.PI;
  return angle >= 0 && angle <= turn + TURN_SLACK;
}

function trigValue(params: {
  angle: number;
  fields: UnitCircleFields;
  name: (typeof trigNames)[number];
}): number | null {
  const radians =
    params.fields.angleUnit === "degrees"
      ? (params.angle * Math.PI) / HALF_TURN_DEGREES
      : params.angle;

  if (params.name === "tan" && Math.abs(Math.cos(radians)) < TANGENT_LIMIT) {
    return null;
  }

  return trigFunctions[params.name](radians);
}

export const unitCircleTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "Turn a point around a circle of radius 1 and watch sine (height), cosine (sideways distance) and tangent draw themselves, with the wave each one traces. The learner turns once around, so angles go from 0 to 360° (or 0 to 2π). A numeric check reads `output` (sin, cos or tan, one of the values shown) at the `angle` input. Fills: the start angle, degrees or radians, which values to show, the real-world frame and the check question.",
  fields: unitCircleFields,
  id: "unitCircle",
  needsData: false,
  value: (fields, target) => {
    const name = trigNames.find((item) => item === (target.output ?? fields.show[0]));
    const angle = target.inputs.angle ?? fields.startAngle;

    return name && fields.show.includes(name) && isWithinTurn(fields, angle)
      ? trigValue({ angle, fields, name })
      : null;
  },
  verify: (fields) => [
    ...duplicateIssues(fields.show, "fields.show", "Value"),
    ...(isWithinTurn(fields, fields.startAngle)
      ? []
      : [
          issue(
            "inconsistentFields",
            "fields.startAngle",
            "The start angle must be within one turn: 0 to 360° or 0 to 2π",
          ),
        ]),
  ],
});
