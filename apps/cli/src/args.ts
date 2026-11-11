import { parseArgs } from "node:util";
import { usageError } from "./errors.ts";

export type ApiRequest =
  | { method: "GET"; path: string }
  | { body: Record<string, unknown>; method: "POST"; path: string };

export type Command =
  | { name: "help" }
  | { name: "login" }
  | { name: "logout" }
  | { name: "request"; request: ApiRequest };

type Options = { limit?: string; offset?: string; order?: string; where?: string[] };

type OptionName = keyof Options;

type CommandSpec = {
  arguments: number | "at least one";
  build: (args: string[], options: Options) => Command;
  options: OptionName[];
};

export const WHOAMI_REQUEST: ApiRequest = { method: "GET", path: "/staff/me" };

const OPERATORS = ["eq", "ne", "in", "notIn", "isNull", "notNull", "gt", "gte", "lt", "lte"];
const OPERATORS_WITHOUT_VALUE = new Set(["isNull", "notNull"]);
const OPERATORS_WITH_LIST = new Set(["in", "notIn"]);
const WHERE_PATTERN = /^(?<field>\S+)\s+(?<op>\S+)(?:\s+(?<value>[\s\S]+))?$/u;
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
  const { field, op, value } = WHERE_PATTERN.exec(clause.trim())?.groups ?? {};

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

  if (!value) {
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

  if (!WHOLE_NUMBER_PATTERN.test(value)) {
    throw usageError(`--${name} needs a whole number, not "${value}".`);
  }

  return Number(value);
}

function get(path: string): Command {
  return { name: "request", request: { method: "GET", path } };
}

function post(path: string, body: Record<string, unknown>): Command {
  return { name: "request", request: { body, method: "POST", path } };
}

const COMMANDS = new Map<string, CommandSpec>([
  ["login", { arguments: 0, build: () => ({ name: "login" }), options: [] }],
  ["logout", { arguments: 0, build: () => ({ name: "logout" }), options: [] }],
  [
    "whoami",
    { arguments: 0, build: () => ({ name: "request", request: WHOAMI_REQUEST }), options: [] },
  ],
  ["staff models", { arguments: 0, build: () => get("/staff/models"), options: [] }],
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
      build: ([model, id]) => post("/staff/records/get", { id, model }),
      options: [],
    },
  ],
  [
    "staff list",
    {
      arguments: 1,
      build: ([model], { limit, offset, order, where }) =>
        post("/staff/records/list", {
          limit: parseWholeNumber("limit", limit),
          model,
          offset: parseWholeNumber("offset", offset),
          orderBy: parseOrder(order),
          where: parseWhereOptions(where),
        }),
      options: ["where", "order", "limit", "offset"],
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

function describeArguments(count: CommandSpec["arguments"]): string {
  if (count === "at least one") {
    return "at least one argument";
  }

  return count === 1 ? "1 argument" : `${count} arguments`;
}

function checkArguments({ args, name, spec }: { args: string[]; name: string; spec: CommandSpec }) {
  const fits = spec.arguments === "at least one" ? args.length > 0 : args.length === spec.arguments;

  if (!fits) {
    throw usageError(`"${name}" takes ${describeArguments(spec.arguments)}.`);
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
        help: { short: "h", type: "boolean" },
        limit: { type: "string" },
        offset: { type: "string" },
        order: { type: "string" },
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
