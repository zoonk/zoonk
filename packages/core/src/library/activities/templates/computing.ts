import { aimForCharacters } from "@zoonk/utils/character-target";
import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  optionTextSchema,
  promptSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { aimForItems, codeSchema, identifierSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { duplicateIssues, issue } from "./_utils/template-helpers";
import { normalizeProgramOutput } from "./_utils/text-normalizers";

const EDITABLE_LINES_TARGET = 10;
const OUTPUT_TARGET = 500;
const MISTAKES_TARGET = 4;
const PAUSES_TARGET = 4;
const PAUSE_OPTIONS_TARGET = 4;
const TRACE_STEPS_TARGET = 40;
const WATCHED_TARGET = 4;
const TRACE_VALUE_TARGET = 60;
const COLUMNS_TARGET = 6;
const ROWS_TARGET = 30;
const TABLES_TARGET = 3;

const languageSchema = z.enum(["javascript", "python"]);

function codeLines(code: string): string[] {
  return code.split("\n");
}

function lineCount(code: string): number {
  return codeLines(code).length;
}

const codeRunnerFields = z
  .object({
    editableLines: z
      .array(z.number().int().positive())
      .min(1)
      .describe(aimForItems(EDITABLE_LINES_TARGET)),
    expectedOutput: aimForCharacters(z.string().min(1), OUTPUT_TARGET),
    fileName: labelSchema.optional(),
    language: languageSchema,
    mistakes: z
      .array(
        z
          .object({
            feedback: explanationSchema,
            output: aimForCharacters(z.string(), OUTPUT_TARGET),
          })
          .strict(),
      )
      .describe(aimForItems(MISTAKES_TARGET)),
    solution: codeSchema,
    starterCode: codeSchema,
  })
  .strict();

type CodeRunnerFields = z.output<typeof codeRunnerFields>;

function sameLine(first: string | undefined, second: string | undefined): boolean {
  return first?.trimEnd() === second?.trimEnd();
}

function solutionIssues(fields: CodeRunnerFields) {
  const [starter, solution] = [codeLines(fields.starterCode), codeLines(fields.solution)];
  const editable = new Set(fields.editableLines);

  const changesOtherLines =
    solution.length !== starter.length ||
    starter.some((line, index) => !editable.has(index + 1) && !sameLine(line, solution[index]));

  if (changesOtherLines) {
    return [
      issue(
        "inconsistentFields",
        "fields.solution",
        "The solution must be the starter code with only the editable lines changed",
      ),
    ];
  }

  return fields.editableLines.some((line) => !sameLine(starter[line - 1], solution[line - 1]))
    ? []
    : [
        issue(
          "missingInteraction",
          "fields.solution",
          "The starter code is already the solution; leave the learner a line to fix",
        ),
      ];
}

export const codeRunnerTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Run and fix real code in the browser (JavaScript, or Python through Pyodide), like an off-by-one loop. The learner's program output must equal the expected output. `solution` is the starter code with the editable lines fixed; code runs it before publishing, and `expectedOutput` must be exactly what it prints. JavaScript's console.log prints like Node on one line (arrays as [ 1, 2 ], objects as { a: 1 }); Python has its standard library but no input() and no network. Keep output the same on every run and every device: no randomness, clock, time zone or locale formatting. Fills: the language, starter code, editable lines, the solution, expected output and feedback keyed by the output of each likely mistake.",
  expected: (fields) => ({ kind: "output", output: normalizeProgramOutput(fields.expectedOutput) }),
  fields: codeRunnerFields,
  id: "codeRunner",
  needsData: false,
  verify: (fields) => [
    ...[
      fields.editableLines.some((line) => line > lineCount(fields.starterCode)) &&
        issue(
          "inconsistentFields",
          "fields.editableLines",
          "An editable line is past the end of the code",
        ),
      fields.mistakes.some(
        (mistake) =>
          normalizeProgramOutput(mistake.output) === normalizeProgramOutput(fields.expectedOutput),
      ) && issue("inconsistentFields", "fields.mistakes", "A mistake produces the expected output"),
    ].filter((item) => item !== false),
    ...solutionIssues(fields),
  ],
});

const traceValueSchema = z.union([
  aimForCharacters(z.string(), TRACE_VALUE_TARGET),
  z.number(),
  z.boolean(),
]);

const codeTracerFields = z
  .object({
    code: codeSchema,
    language: languageSchema,
    pauses: z
      .array(
        z
          .object({
            options: uniqueIdsSchema(z.object({ id: idSchema, text: labelSchema }).strict(), {
              min: 2,
            }).describe(aimForItems(PAUSE_OPTIONS_TARGET)),
            question: promptSchema,
            step: z.number().int().nonnegative(),
            variable: identifierSchema,
          })
          .strict(),
      )
      .min(1)
      .describe(aimForItems(PAUSES_TARGET)),
    trace: z
      .array(
        z
          .object({
            line: z.number().int().positive(),
            values: z.array(z.object({ name: identifierSchema, value: traceValueSchema }).strict()),
          })
          .strict(),
      )
      .min(2)
      .describe(aimForItems(TRACE_STEPS_TARGET)),
    watch: z.array(identifierSchema).min(1).describe(aimForItems(WATCHED_TARGET)),
  })
  .strict();

type CodeTracerFields = z.output<typeof codeTracerFields>;
type Pause = CodeTracerFields["pauses"][number];

function tracedValue(fields: CodeTracerFields, pause: Pause): string | null {
  const value = fields.trace[pause.step]?.values.find(
    (item) => item.name === pause.variable,
  )?.value;

  return value === undefined ? null : String(value);
}

function matchingOptions(fields: CodeTracerFields, pause: Pause) {
  const value = tracedValue(fields, pause);
  return pause.options.filter((option) => option.text.trim() === value);
}

function tracerIssues(fields: CodeTracerFields) {
  return [
    ...fields.trace
      .filter((step) => step.line > lineCount(fields.code))
      .map(() =>
        issue("inconsistentFields", "fields.trace", "A trace step points past the end of the code"),
      ),
    ...fields.pauses.flatMap((pause, index) => {
      const path = `fields.pauses.${index}`;

      if (!fields.watch.includes(pause.variable) || tracedValue(fields, pause) === null) {
        return [
          issue("inconsistentFields", path, "The pause asks about a value the trace doesn't show"),
        ];
      }

      return matchingOptions(fields, pause).length === 1
        ? []
        : [issue("answerMismatch", path, "Exactly one option must equal the traced value")];
    }),
  ];
}

export const codeTracerTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Step through code line by line and predict what changes, like binary search narrowing a list. Each trace step is a line right after it runs, with the watched values it changed; a value not listed keeps its last one. Code runs the program before publishing and the trace must match that run: steps in the order the lines run (steps may be skipped), every shown value as it is at that moment, and a program that finishes. Write numbers as numbers, text without quotes and lists like [1, 2]. At each pause the correct option is the one equal to the traced value. Fills: the code, input values, variables to watch, the trace, and pause points with their prediction questions.",
  expected: (fields) => ({
    kind: "assignment",
    pairs: Object.fromEntries(
      fields.pauses.map((pause, index) => [
        String(index),
        matchingOptions(fields, pause)[0]?.id ?? "",
      ]),
    ),
  }),
  fields: codeTracerFields,
  id: "codeTracer",
  needsData: false,
  verify: (fields) => tracerIssues(fields),
});

const cellSchema = z.union([
  aimForCharacters(z.string(), TRACE_VALUE_TARGET),
  z.number(),
  z.null(),
]);

const columnTypeSchema = z.enum(["integer", "real", "text"]);

const sqlFields = z
  .object({
    expected: z
      .object({
        columns: z.array(labelSchema).min(1).describe(aimForItems(COLUMNS_TARGET)),
        orderMatters: z.boolean(),
        rows: z.array(z.array(cellSchema)).describe(aimForItems(ROWS_TARGET)),
      })
      .strict(),
    mistakes: z
      .array(z.object({ feedback: explanationSchema, mistake: optionTextSchema }).strict())
      .describe(aimForItems(MISTAKES_TARGET)),
    solution: codeSchema,
    tables: z
      .array(
        z
          .object({
            columns: z
              .array(z.object({ name: identifierSchema, type: columnTypeSchema }).strict())
              .min(1)
              .describe(aimForItems(COLUMNS_TARGET)),
            name: identifierSchema,
            rows: z.array(z.array(cellSchema)).min(1).describe(aimForItems(ROWS_TARGET)),
          })
          .strict(),
      )
      .min(1)
      .describe(aimForItems(TABLES_TARGET)),
  })
  .strict();

function cellFits(
  cell: z.output<typeof cellSchema>,
  type: z.output<typeof columnTypeSchema>,
): boolean {
  if (cell === null) {
    return true;
  }

  if (type === "text") {
    return typeof cell === "string";
  }

  return typeof cell === "number" && (type === "real" || Number.isInteger(cell));
}

function sqlIssues(fields: z.output<typeof sqlFields>) {
  return [
    ...duplicateIssues(
      fields.tables.map((table) => table.name),
      "fields.tables",
      "Table",
    ),
    ...fields.tables.flatMap((table, index) =>
      table.rows.some(
        (row) =>
          row.length !== table.columns.length ||
          row.some((cell, column) => !cellFits(cell, table.columns[column]?.type ?? "text")),
      )
        ? [
            issue(
              "inconsistentFields",
              `fields.tables.${index}.rows`,
              "A row doesn't fit the columns",
            ),
          ]
        : [],
    ),
    ...(fields.expected.rows.some((row) => row.length !== fields.expected.columns.length)
      ? [
          issue(
            "inconsistentFields",
            "fields.expected.rows",
            "An expected row doesn't fit the columns",
          ),
        ]
      : []),
  ];
}

export const sqlPlaygroundTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Query small tables with real SQLite in the browser, like filtering countries by continent and population. The learner's result must equal the expected rows (in order when `orderMatters`). Code runs the reference `solution` before publishing and the player runs it too, so its result must equal the expected rows exactly: the same column names, the same values (no rounding the query doesn't do) and, when `orderMatters`, the same order. Fills: the schema and rows (cited or labeled as an example), the question, the expected result and feedback for likely mistakes.",
  expected: (fields) => ({
    columns: fields.expected.columns,
    kind: "rows",
    orderMatters: fields.expected.orderMatters,
    rows: fields.expected.rows,
  }),
  fields: sqlFields,
  id: "sqlPlayground",
  needsData: true,
  verify: (fields) => sqlIssues(fields),
});
