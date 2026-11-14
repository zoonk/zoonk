import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { usageError } from "./errors.ts";
import { commandUsage } from "./help.ts";
import { isRecord, parseJson } from "./http.ts";
import { type OutputShape } from "./output.ts";
import { parseOrder, parseWhereOptions, splitList } from "./query-options.ts";

export type ApiRequest =
  | { method: "GET"; path: string }
  | { body: Record<string, unknown>; method: "POST"; path: string };

export type Command =
  | { name: "help" }
  | { name: "login" }
  | { name: "logout" }
  | { name: "request"; request: ApiRequest; shape?: OutputShape };

type Options = {
  batch?: string;
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

const WHOLE_NUMBER_PATTERN = /^\d+$/u;
const LONGEST_COMMAND_WORDS = 3;

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
    throw usageError(
      `${path} must hold one JSON object: { reason, feedbackId?, changes } or { reason, fixes: [{ changes }] }.`,
    );
  }

  return body;
}

function requireReason(reason: string | undefined): string {
  if (!reason?.trim()) {
    throw usageError(`Say why with --reason "<why the fix is wrong>".`);
  }

  return reason;
}

function fixTarget({
  args,
  batch,
  command,
}: {
  args: string[];
  batch: string | undefined;
  command: string;
}) {
  const [fixId, ...extra] = args;

  if (extra.length > 0 || (fixId === undefined) === (batch === undefined)) {
    throw usageError(`"staff fixes ${command}" takes one fix id, or --batch <batchId>.`);
  }

  return fixId === undefined ? { batchId: batch } : { fixId };
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
      arguments: "any",
      build: (args, { batch, reason }) =>
        post("/staff/content-fixes/revert", {
          ...fixTarget({ args, batch, command: "revert" }),
          reason: requireReason(reason),
        }),
      options: ["batch", "reason"],
    },
  ],
  [
    "staff fixes withdraw",
    {
      arguments: "any",
      build: (args, { batch }) =>
        post("/staff/content-fixes/withdraw", fixTarget({ args, batch, command: "withdraw" })),
      options: ["batch"],
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
    throw usageError(`"${name}" takes ${describeArguments(expected)}: ${commandUsage(name)}`);
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

/** Node follows "Unknown option '--x'." with advice about positional arguments no command here takes. */
function describeParseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return /^Unknown option '[^']+'\./u.exec(message)?.[0] ?? message;
}

function parseCommandLine(argv: string[]) {
  try {
    return parseArgs({
      allowPositionals: true,
      args: argv,
      options: {
        api: { type: "string" },
        batch: { type: "string" },
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
    throw usageError(describeParseError(error));
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
