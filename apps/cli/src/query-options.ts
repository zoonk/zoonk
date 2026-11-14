import { usageError } from "./errors.ts";

const OPERATORS = ["eq", "ne", "in", "notIn", "isNull", "notNull", "gt", "gte", "lt", "lte"];
const OPERATORS_WITHOUT_VALUE = new Set(["isNull", "notNull"]);
const OPERATORS_WITH_LIST = new Set(["in", "notIn"]);
const WHERE_PATTERN = /^(?<field>[^ ]+) (?<op>[^ ]+)(?: (?<value>[\s\S]*))?$/u;
const ORDER_PATTERN = /^(?<field>[^:\s]+)(?::(?<direction>asc|desc))?$/u;

export function splitList(value: string): string[] {
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

export function parseWhereOptions(clauses: string[] | undefined) {
  return clauses?.map((clause) => parseWhere(clause));
}

export function parseOrder(order: string | undefined) {
  if (order === undefined) {
    return;
  }

  const { direction = "asc", field } = ORDER_PATTERN.exec(order)?.groups ?? {};

  if (!field) {
    throw usageError(`--order "${order}" needs the form "<field>" or "<field>:asc|desc".`);
  }

  return { direction, field };
}
