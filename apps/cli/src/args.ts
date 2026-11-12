import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { usageError } from "./errors.ts";
import { isRecord, parseJson } from "./http.ts";
import { type OutputShape } from "./output.ts";

export type ApiRequest =
  | { method: "GET"; path: string }
  | { body: Record<string, unknown>; method: "POST"; path: string };

export type Command =
  | { name: "help" }
  | { name: "login" }
  | { name: "logout" }
  | { name: "request"; request: ApiRequest; shape?: OutputShape };

type Options = {
  fields?: string;
  limit?: string;
  offset?: string;
  order?: string;
  reason?: string;
  where?: string[];
};

type OptionName = keyof Options;

type CommandSpec = {
  arguments: number | "any" | "at least one";
  build: (args: string[], options: Options) => Command;
  options: OptionName[];
};

export const WHOAMI_REQUEST: ApiRequest = { method: "GET", path: "/staff/me" };

const OPERATORS = ["eq", "ne", "in", "notIn", "isNull", "notNull", "gt", "gte", "lt", "lte"];
const OPERATORS_WITHOUT_VALUE = new Set(["isNull", "notNull"]);
const OPERATORS_WITH_LIST = new Set(["in", "notIn"]);
const WHERE_PATTERN = /^(?<field>[^ ]+) (?<op>[^ ]+)(?: (?<value>[\s\S]*))?$/u;
const ORDER_PATTERN = /^(?<field>[^:\s]+)(?::(?<direction>asc|desc))?$/u;
const WHOLE_NUMBER_PATTERN = /^\d+$/u;
const LONGEST_COMMAND_WORDS = 3;

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWhere(clause: string) {
  const { field, op, value } = WHERE_PATTERN.exec(clause)?.groups ?? {};

  if (!field || !op) {
    throw usageError(`--where "${clause}" needs the form "<field> <op> <value>".`);
  }

  if (!OPERATORS.includes(op)) {
    throw usageError(`--where "${clause}" has no operator "${op}". Use ${OPERATORS.join(", ")}.`);
  }

  if (OPERATORS_WITHOUT_VALUE.has(op)) {
    if (value) {
      throw usageError(`--where "${clause}": ${op} takes no value.`);
    }

    return { field, op };
  }

  if (value === undefined) {
    throw usageError(`--where "${clause}" needs a value after ${op}.`);
  }

  return { field, op, value: OPERATORS_WITH_LIST.has(op) ? splitList(value) : value };
}

function parseWhereOptions(clauses: string[] | undefined) {
  return clauses?.map((clause) => parseWhere(clause));
}

function parseOrder(order: string | undefined) {
  if (order === undefined) {
    return;
  }

  const { direction = "asc", field } = ORDER_PATTERN.exec(order)?.groups ?? {};

  if (!field) {
    throw usageError(`--order "${order}" needs the form "<field>" or "<field>:asc|desc".`);
  }

  return { direction, field };
}

function parseWholeNumber(name: OptionName, value: string | undefined) {
  if (value === undefined) {
    return;
  }

  const number = Number(value);

  if (!WHOLE_NUMBER_PATTERN.test(value) || !Number.isSafeInteger(number)) {
    throw usageError(`--${name} needs a whole number, not "${value}".`);
  }

  return number;
}

function parseFields(fields: string | undefined): OutputShape | undefined {
  if (fields === undefined) {
    return;
  }

  const names = splitList(fields);

  if (names.length === 0) {
    throw usageError(`--fields needs comma-separated field names, such as "id,status,createdAt".`);
  }

  return { fields: names, kind: "fields" };
}

function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw usageError(`Can't read ${path}.`);
  }
}

function readJsonObject(path: string): Record<string, unknown> {
  const body = parseJson(readText(path));

  if (!isRecord(body)) {
    throw usageError(`${path} must hold one JSON object: { reason, feedbackId?, changes }.`);
  }

  return body;
}

function requireReason(reason: string | undefined): string {
  if (!reason?.trim()) {
    throw usageError(`Say why with --reason "<why the fix is wrong>".`);
  }

  return reason;
}

function get(path: string, shape?: OutputShape): Command {
  return { name: "request", request: { method: "GET", path }, shape };
}

function post(path: string, body: Record<string, unknown>, shape?: OutputShape): Command {
  return { name: "request", request: { body, method: "POST", path }, shape };
}

const COMMANDS = new Map<string, CommandSpec>([
  ["login", { arguments: 0, build: () => ({ name: "login" }), options: [] }],
  ["logout", { arguments: 0, build: () => ({ name: "logout" }), options: [] }],
  [
    "whoami",
    { arguments: 0, build: () => ({ name: "request", request: WHOAMI_REQUEST }), options: [] },
  ],
  [
    "staff models",
    {
      arguments: "any",
      build: (names) => get("/staff/models", { kind: "models", names }),
      options: [],
    },
  ],
  [
    "staff users find",
    { arguments: 1, build: ([query]) => post("/staff/users/find", { query }), options: [] },
  ],
  [
    "staff users search",
    {
      arguments: "at least one",
      build: (words, { limit }) =>
        post("/staff/users/search", {
          limit: parseWholeNumber("limit", limit),
          query: words.join(" "),
        }),
      options: ["limit"],
    },
  ],
  [
    "staff get",
    {
      arguments: 2,
      build: ([model, id], { fields }) =>
        post("/staff/records/get", { id, model }, parseFields(fields)),
      options: ["fields"],
    },
  ],
  [
    "staff list",
    {
      arguments: 1,
      build: ([model], { fields, limit, offset, order, where }) =>
        post(
          "/staff/records/list",
          {
            limit: parseWholeNumber("limit", limit),
            model,
            offset: parseWholeNumber("offset", offset),
            orderBy: parseOrder(order),
            where: parseWhereOptions(where),
          },
          parseFields(fields),
        ),
      options: ["where", "order", "limit", "offset", "fields"],
    },
  ],
  [
    "staff fixes propose",
    {
      arguments: 1,
      build: ([file = ""]) => post("/staff/content-fixes", readJsonObject(file)),
      options: [],
    },
  ],
  [
    "staff fixes revert",
    {
      arguments: 1,
      build: ([fixId], { reason }) =>
        post("/staff/content-fixes/revert", { fixId, reason: requireReason(reason) }),
      options: ["reason"],
    },
  ],
  [
    "staff count",
    {
      arguments: 1,
      build: ([model], { where }) =>
        post("/staff/records/count", { model, where: parseWhereOptions(where) }),
      options: ["where"],
    },
  ],
]);

function longestCommandName(positionals: string[]): string | undefined {
  return Array.from({ length: LONGEST_COMMAND_WORDS }, (_, index) =>
    positionals.slice(0, LONGEST_COMMAND_WORDS - index).join(" "),
  ).find((candidate) => COMMANDS.has(candidate));
}

function findCommand(positionals: string[]) {
  const name = longestCommandName(positionals);
  const spec = name ? COMMANDS.get(name) : undefined;

  if (!name || !spec) {
    throw usageError(`Unknown command "${positionals.join(" ")}".`);
  }

  return { args: positionals.slice(name.split(" ").length), name, spec };
}

function describeArguments(count: number | "at least one"): string {
  if (count === "at least one") {
    return "at least one argument";
  }

  return count === 1 ? "1 argument" : `${count} arguments`;
}

function checkArguments({ args, name, spec }: { args: string[]; name: string; spec: CommandSpec }) {
  const expected = spec.arguments;

  if (expected === "any") {
    return;
  }

  const fits = expected === "at least one" ? args.length > 0 : args.length === expected;

  if (!fits) {
    throw usageError(`"${name}" takes ${describeArguments(expected)}.`);
  }
}

function checkOptions({
  name,
  options,
  spec,
}: {
  name: string;
  options: Options;
  spec: CommandSpec;
}) {
  const unexpected = Object.keys(options).find(
    (option) => !spec.options.some((allowed) => allowed === option),
  );

  if (unexpected) {
    throw usageError(`"${name}" has no --${unexpected} option.`);
  }
}

function parseCommandLine(argv: string[]) {
  try {
    return parseArgs({
      allowPositionals: true,
      args: argv,
      options: {
        api: { type: "string" },
        fields: { type: "string" },
        help: { short: "h", type: "boolean" },
        limit: { type: "string" },
        offset: { type: "string" },
        order: { type: "string" },
        reason: { type: "string" },
        where: { multiple: true, type: "string" },
      },
    });
  } catch (error) {
    throw usageError(error instanceof Error ? error.message : String(error));
  }
}

export function parseInvocation(argv: string[]): { apiUrl?: string; command: Command } {
  const { positionals, values } = parseCommandLine(argv);
  const { api, help, ...options } = values;

  if (help || positionals.length === 0 || positionals[0] === "help") {
    return { apiUrl: api, command: { name: "help" } };
  }

  const { args, name, spec } = findCommand(positionals);

  checkArguments({ args, name, spec });
  checkOptions({ name, options, spec });

  return { apiUrl: api, command: spec.build(args, options) };
}
