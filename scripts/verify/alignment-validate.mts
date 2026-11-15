import { z } from "zod";
import { type AlignmentFile, ELEMENT_PARTS } from "./alignment-capture.mts";

/**
 * What a capture must hold before the evaluator reads it (`REPORT-SHAPE.md`): a file from another
 * platform or an older capture run that doesn't match is refused, never judged as a clean screen.
 */
const NOT_MEASURED = z.literal("not measured");
const BOUNDS = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/** Each platform's logical unit. */
const UNITS = { android: "dp", apple: "pt", web: "px" } as const;

const MEASURE = z.union([z.number(), NOT_MEASURED]);

/** The optional fields the evaluator reads, with their types: a string where it reads a flag or a number is refused. */
const OPTIONAL = z
  .object({
    anchor: z.string(),
    baseline: MEASURE,
    capBottom: MEASURE,
    capTop: MEASURE,
    column: z.tuple([z.number(), z.number()]),
    current: z.boolean(),
    direction: z.enum(["ltr", "rtl"]),
    disabled: z.boolean(),
    endEdge: MEASURE,
    firstLine: BOUNDS,
    flow: z.string(),
    frame: z.tuple([z.number(), z.number()]),
    gap: MEASURE,
    gapBefore: MEASURE,
    kind: z.enum(["box", "hairline", "highlight", "picture", "tab"]),
    layoutScale: z.number().positive(),
    lines: z.union([z.int().positive(), NOT_MEASURED]),
    margins: z.tuple([z.number(), z.number()]),
    middle: MEASURE,
    name: z.string(),
    note: z.boolean(),
    reason: z.string(),
    source: z.enum(["piece", "picture", "stack"]),
    stacked: z.boolean(),
    surface: z.string(),
    target: z.string(),
    text: z.string(),
    textBox: z.enum(["capitals", "ideographic face"]),
    type: z.string(),
    variant: z.string(),
  })
  .partial().shape;

const PLACE = {
  ...OPTIONAL,
  bounds: BOUNDS,
  group: z.string().nullable(),
  id: z.string(),
  row: z.string().nullable(),
};

const ELEMENT = z.union([
  z.looseObject({
    ...PLACE,
    ink: z.union([BOUNDS, NOT_MEASURED, z.null()]),
    part: z.enum(ELEMENT_PARTS),
    piece: z.string(),
  }),
  // An area the platform can't read (a subtree whose semantics were replaced): only its place.
  z.looseObject({ ...PLACE, part: z.literal("unmeasured") }),
  // A state pair's anchor as Android writes it: its name and place, or no place when the node
  // wasn't found (a lazy row off screen), which the pair can't measure.
  z
    .looseObject({
      anchor: z.string(),
      bounds: z.union([BOUNDS, NOT_MEASURED]),
      id: z.string(),
      part: z.literal("anchor"),
    })
    .transform(({ bounds, ...anchor }) => ({
      group: null,
      ink: null,
      piece: "anchor",
      row: null,
      ...anchor,
      ...(bounds === "not measured" ? { bounds: [0, 0, 0, 0], unplaced: true } : { bounds }),
    })),
]);

const CAPTURE = z
  .looseObject({
    activeSurface: z.string(),
    configuration: z.looseObject({
      height: z.number(),
      locale: z.string(),
      pointer: z.enum(["keys", "touch"]),
      scheme: z.string(),
      size: z.string(),
      textScale: z.number(),
      width: z.number(),
    }),
    elements: z.array(ELEMENT),
    panels: z.array(z.string()).optional(),
    platform: z.enum(["android", "apple", "web"]),
    scale: z.number().positive(),
    scenario: z.string().nullable(),
    screen: z.string(),
    specimen: z.boolean().optional(),
    unit: z.enum(["dp", "pt", "px"]),
    version: z.literal(1),
  })
  .superRefine((capture, context) => {
    if (UNITS[capture.platform] !== capture.unit) {
      context.addIssue({
        code: "custom",
        message: `${capture.platform} measures in ${UNITS[capture.platform]}, not ${capture.unit}`,
        path: ["unit"],
      });
    }

    const groups = new Set(
      capture.elements.flatMap((item) => (item.part === "group" ? [item.id] : [])),
    );

    const rows = new Set(
      capture.elements.flatMap((item) => (item.part === "row" ? [item.id] : [])),
    );

    for (const [index, item] of capture.elements.entries()) {
      if (item.group !== null && !groups.has(item.group)) {
        context.addIssue({
          code: "custom",
          message: `no group ${item.group}`,
          path: ["elements", index, "group"],
        });
      }

      if (item.row !== null && !rows.has(item.row)) {
        context.addIssue({
          code: "custom",
          message: `no row ${item.row}`,
          path: ["elements", index, "row"],
        });
      }
    }
  });

const FILE = z.looseObject({ captures: z.array(CAPTURE) });

type Read =
  /** JSON that claims to be neither captures nor a capture. */
  | { kind: "other" }
  | { kind: "invalid"; problems: string }
  | { file: AlignmentFile; kind: "captures"; single: boolean };

/** A file holding captures, or one capture, checked against the shape before anything judges it. */
export function readCaptures(parsed: unknown): Read {
  if (typeof parsed !== "object" || parsed === null) {
    return { kind: "other" };
  }

  const single = !("captures" in parsed);

  if (single && !("version" in parsed) && !("elements" in parsed)) {
    return { kind: "other" };
  }

  const checked = single ? CAPTURE.safeParse(parsed) : FILE.safeParse(parsed);

  if (!checked.success) {
    return { kind: "invalid", problems: z.prettifyError(checked.error) };
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Checked against the shape; a capture's other fields are optional.
  const file = (single ? { captures: [checked.data] } : checked.data) as AlignmentFile;

  return { file, kind: "captures", single };
}
