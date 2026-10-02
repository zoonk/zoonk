import { z } from "zod";
import { type ActivityCell } from "../activity-expected-answer";
import { formatConsoleArgs, formatConsoleValue } from "./console-values";
import { MAX_PROGRAM_OUTPUT_LENGTH, type ProgramKind } from "./program-limits";
import { parsePythonError } from "./python-error";
import { toSqlCell } from "./sql-setup";

/** A watched value as the runner sends it; `value` is JavaScript's console-ready data. */
const tracedWireSchema = z
  .union([
    z.tuple([z.literal("boolean"), z.boolean()]),
    z.tuple([z.literal("number"), z.number()]),
    z.tuple([z.literal("string"), z.string()]),
    z.tuple([z.literal("text"), z.string()]),
    z.tuple([z.literal("value"), z.unknown()]),
  ])
  .nullable();

const statusSchema = z.enum([
  "crashed",
  "done",
  "error",
  "timeout",
  "tooManySteps",
  "tooMuchOutput",
]);

const resultSchema = z.object({
  error: z
    .union([z.object({ line: z.number().nullable(), message: z.string() }), z.string()])
    .nullish(),
  logs: z.array(z.tuple([z.enum(["stderr", "stdout"]), z.array(z.unknown())])).optional(),
  status: statusSchema,
  stderr: z.string().optional(),
  stdout: z.string().optional(),
  steps: z.array(z.tuple([z.number().int(), z.array(tracedWireSchema)])).optional(),
  table: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.unknown())) }).optional(),
});

export type RunnerResult = z.infer<typeof resultSchema>;

/** The runner's stdout protocol: `ready` once its runtimes loaded, then one result per job. */
export const runnerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ id: z.number(), result: resultSchema, type: z.literal("result") }),
]);

/** A watched value at one step, typed where the language's value is plain, as text otherwise. */
export type TracedValue =
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "text"; text: string };

/** A line that ran, with each watched value (in watch order) or null where it doesn't exist. */
export type TraceStep = { line: number; values: (TracedValue | null)[] };

export type ProgramRun = {
  error: { line: number | null; message: string } | null;
  /** What the program printed to stdout: the output the code runner compares. */
  output: string;
  status: z.infer<typeof statusSchema>;
  steps: TraceStep[];
  table: { columns: string[]; rows: ActivityCell[][] } | null;
};

function toTracedValue(wire: z.infer<typeof tracedWireSchema>): TracedValue | null {
  if (wire === null) {
    return null;
  }

  switch (wire[0]) {
    case "boolean":
      return { kind: "boolean", value: wire[1] };
    case "number":
      return { kind: "number", value: wire[1] };
    case "string":
      return { kind: "string", value: wire[1] };
    case "text":
      return { kind: "text", text: wire[1] };
    case "value":
      return { kind: "text", text: formatConsoleValue(wire[1]) };
    default:
      return null;
  }
}

/** JavaScript logs print like the player prints them: one formatted line per call. */
function streamsOf(result: RunnerResult): { stderr: string; stdout: string } {
  if (!result.logs) {
    return { stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
  }

  const text = (stream: "stderr" | "stdout") =>
    (result.logs ?? [])
      .filter(([logStream]) => logStream === stream)
      .map(([, args]) => `${formatConsoleArgs(args)}\n`)
      .join("");

  return { stderr: text("stderr"), stdout: text("stdout") };
}

function errorOf(kind: ProgramKind, error: RunnerResult["error"]): ProgramRun["error"] {
  if (!error) {
    return null;
  }

  if (typeof error !== "string") {
    return error;
  }

  return kind === "python" ? parsePythonError(error) : { line: null, message: error };
}

/**
 * A runner result as the check reads it, with the player's output rules: logs formatted like
 * Node, stdout cut at the output limit, and a run that printed more than that counted as a flood.
 */
export function toProgramRun(kind: ProgramKind, result: RunnerResult): ProgramRun {
  const { stderr, stdout } = streamsOf(result);
  const flooded = stdout.length + stderr.length > MAX_PROGRAM_OUTPUT_LENGTH;

  return {
    error: errorOf(kind, result.error),
    output: stdout.slice(0, MAX_PROGRAM_OUTPUT_LENGTH),
    status: flooded && result.status === "done" ? "tooMuchOutput" : result.status,
    steps: (result.steps ?? []).map(([line, values]) => ({
      line,
      values: values.map((value) => toTracedValue(value)),
    })),
    table: result.table
      ? {
          columns: result.table.columns,
          rows: result.table.rows.map((row) => row.map((cell) => toSqlCell(cell))),
        }
      : null,
  };
}
