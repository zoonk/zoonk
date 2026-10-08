/**
 * How a JavaScript program's `console.log` output becomes text, shared by the player's browser
 * sandbox and the server check before publishing, so both print a program the same way and a
 * lesson's expected output means the same thing in both places.
 *
 * Inside a sandbox, `toCloneable` turns each argument into plain data: primitives and arrays as
 * they are, everything else tagged, because functions and class instances can't leave the
 * sandbox. Outside it, `formatConsoleArgs` prints that data like Node does on one line.
 */
export const CONSOLE_VALUE_SOURCE = `
const MAX_DEPTH = 4;

function toCloneable(value, depth, path) {
  if (typeof value === "function") return { $zoonk: "function", name: value.name };
  if (typeof value === "symbol") return { $zoonk: "text", text: value.toString() };
  if (typeof value === "bigint") return { $zoonk: "text", text: value.toString() + "n" };
  if (value === undefined) return { $zoonk: "undefined" };
  if (value === null || typeof value !== "object") return value;
  if (path.includes(value)) return { $zoonk: "circular" };
  if (depth > MAX_DEPTH) return { $zoonk: Array.isArray(value) ? "deepArray" : "deepObject" };
  const next = [...path, value];
  const inner = (item) => toCloneable(item, depth + 1, next);
  if (Array.isArray(value)) return value.map(inner);
  if (value instanceof Error) return { $zoonk: "text", text: value.name + ": " + value.message };
  if (value instanceof Date) return { $zoonk: "text", text: value.toISOString() };
  if (value instanceof Map) return { $zoonk: "map", entries: [...value].map(([key, item]) => [inner(key), inner(item)]) };
  if (value instanceof Set) return { $zoonk: "set", values: [...value].map(inner) };
  const constructor = Object.getPrototypeOf(value)?.constructor;
  const name = constructor && constructor !== Object ? constructor.name : "";
  return { $zoonk: "object", entries: Object.keys(value).map((key) => [key, inner(value[key])]), name };
}
`;

/** Values `toCloneable` produces for what isn't a primitive or an array. */
type TaggedValue =
  | { $zoonk: "circular" | "deepArray" | "deepObject" | "undefined" }
  | { $zoonk: "function"; name: string }
  | { $zoonk: "map"; entries: [unknown, unknown][] }
  | { $zoonk: "object"; entries: [string, unknown][]; name: string }
  | { $zoonk: "set"; values: unknown[] }
  | { $zoonk: "text"; text: string };

const IDENTIFIER = /^[$A-Z_a-z][\w$]*$/u;

function isTagged(value: unknown): value is TaggedValue {
  return typeof value === "object" && value !== null && "$zoonk" in value;
}

/** Strings inside collections are quoted like Node: single quotes unless the text has one. */
function quote(text: string): string {
  return text.includes("'") && !text.includes('"')
    ? `"${text}"`
    : `'${text.replaceAll("'", String.raw`\'`)}'`;
}

function list(open: string, items: readonly string[], close: string): string {
  return items.length === 0 ? `${open}${close}` : `${open} ${items.join(", ")} ${close}`;
}

function formatTagged(value: TaggedValue): string {
  switch (value.$zoonk) {
    case "circular":
      return "[Circular]";
    case "deepArray":
      return "[Array]";
    case "deepObject":
      return "[Object]";
    case "function":
      return value.name ? `[Function: ${value.name}]` : "[Function (anonymous)]";
    case "map":
      return `Map(${value.entries.length}) ${list(
        "{",
        value.entries.map(([key, item]) => `${formatNested(key)} => ${formatNested(item)}`),
        "}",
      )}`;
    case "object": {
      const body = list(
        "{",
        value.entries.map(
          ([key, item]) => `${IDENTIFIER.test(key) ? key : quote(key)}: ${formatNested(item)}`,
        ),
        "}",
      );

      return value.name ? `${value.name} ${body}` : body;
    }
    case "set":
      return `Set(${value.values.length}) ${list(
        "{",
        value.values.map((item) => formatNested(item)),
        "}",
      )}`;
    case "text":
      return value.text;
    case "undefined":
      return "undefined";
    default:
      return "";
  }
}

function formatNested(value: unknown): string {
  return typeof value === "string" ? quote(value) : formatConsoleValue(value);
}

/** One value as `console.log` prints it on its own: strings as they are, the rest like Node. */
export function formatConsoleValue(value: unknown): string {
  if (Array.isArray(value)) {
    return list(
      "[",
      value.map((item) => formatNested(item)),
      "]",
    );
  }

  if (isTagged(value)) {
    return formatTagged(value);
  }

  if (Object.is(value, -0)) {
    return "-0";
  }

  return String(value);
}

/**
 * One `console.log` call as a line of text, the way Node prints it on one line: strings as they
 * are, arrays like `[ 1, 2 ]`, objects like `{ a: 1, b: 'x' }`. The writer is told to expect this.
 */
export function formatConsoleArgs(args: readonly unknown[]): string {
  return args.map((arg) => formatConsoleValue(arg)).join(" ");
}
