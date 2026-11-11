import { AnyNull, type TransactionClient } from "@zoonk/db";
import { type DatabaseField, type DatabaseModel, databaseSchema } from "@zoonk/db/schema";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type StaffFilter, StaffInputError, staffIntegerMax } from "./input";
import { readableFields, readableModels } from "./registry";

const numericText = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/iu;

const integer = z.preprocess(
  numberFromText,
  z
    .int()
    .min(-staffIntegerMax - 1)
    .max(staffIntegerMax),
);

const bigint = z
  .string()
  .regex(/^-?\d+$/u)
  .transform((value) => BigInt(value))
  .pipe(
    z
      .bigint()
      .min(-(2n ** 63n))
      .max(2n ** 63n - 1n),
  );

const decimal = z.union([z.number(), z.string().regex(numericText)]);

export function requireStaffModel(name: string) {
  const model = readableModels.find((entry) => entry.name === name);

  if (!model) {
    throw new StaffInputError(
      `Model is not readable. Valid models: ${readableModels.map((entry) => entry.name).join(", ")}`,
    );
  }

  return model;
}

function requireField({ model, name }: { model: DatabaseModel; name: string }) {
  const fields = readableFields(model);
  const field = fields.find((entry) => entry.name === name);

  if (!field) {
    throw new StaffInputError(
      `Field is not readable. Valid fields: ${fields.map((entry) => entry.name).join(", ")}`,
    );
  }

  return field;
}

function scalarSchema(field: DatabaseField): z.ZodType {
  if (field.kind === "enum") {
    const values = databaseSchema.enums.find((entry) => entry.name === field.type)?.values ?? [];
    return z.enum(values);
  }

  switch (field.type) {
    case "String":
      return field.nativeType?.[0] === "Uuid" ? uuidSchema() : z.string();
    case "Int":
      return integer;
    case "Float":
      return z.preprocess(numberFromText, z.number());
    case "Boolean":
      return z.union([
        z.boolean(),
        z.enum(["true", "false"]).transform((value) => value === "true"),
      ]);
    case "BigInt":
      return bigint;
    case "Decimal":
      return decimal;
    case "DateTime":
      return z
        .union([z.iso.datetime({ offset: true }), z.iso.date()])
        .transform((value) => new Date(value));
    case "Bytes":
      return z.base64().transform((value) => Buffer.from(value, "base64"));
    case "Json":
      return z.preprocess(jsonFromText, z.json());
    default:
      throw new StaffInputError("Field type is not supported");
  }
}

function fieldValue({ field, value }: { field: DatabaseField; value: unknown }): unknown {
  const scalar = scalarSchema(field);
  const schema = field.isList ? z.array(scalar) : scalar;

  return parseFieldValue({
    field,
    schema: field.isRequired ? schema : schema.nullable(),
    value: field.isList ? jsonFromText(value) : value,
  });
}

function parseFieldValue({
  field,
  schema,
  value,
  isList = field.isList,
}: {
  field: DatabaseField;
  schema: z.ZodType;
  value: unknown;
  isList?: boolean;
}): unknown {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    const options =
      field.kind === "enum"
        ? databaseSchema.enums.find((entry) => entry.name === field.type)?.values
        : undefined;

    const expected = isList ? `an array of ${field.type} values` : field.type;

    throw new StaffInputError(
      `Invalid value for ${field.name}. Expected ${expected}.${options ? ` Valid options: ${options.join(", ")}.` : ""}`,
    );
  }

  return parsed.data;
}

function numberFromText(value: unknown): unknown {
  return typeof value === "string" && numericText.test(value) ? Number(value) : value;
}

function jsonFromText(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function allowedOps(field: DatabaseField): string[] {
  if (field.isList) {
    return ["eq"];
  }

  const ordered =
    ["String", "Int", "BigInt", "Float", "Decimal", "DateTime"].includes(field.type) &&
    field.kind !== "enum";

  return [
    "eq",
    "ne",
    ...(field.type === "Json" ? [] : ["in", "notIn"]),
    ...(field.isRequired ? [] : ["isNull", "notNull"]),
    ...(ordered ? ["gt", "gte", "lt", "lte"] : []),
  ];
}

function filterWhere({ model, filter }: { model: DatabaseModel; filter: StaffFilter }) {
  const field = requireField({ model, name: filter.field });
  const ops = allowedOps(field);

  if (!ops.includes(filter.op)) {
    throw new StaffInputError(
      `Invalid operation for ${field.name}. Valid operations: ${ops.join(", ")}`,
    );
  }

  if (filter.op === "isNull" || filter.op === "notNull") {
    if (filter.value !== undefined) {
      throw new StaffInputError(`${filter.op} takes no value`);
    }

    const value = field.type === "Json" ? AnyNull : null;
    return { [field.name]: { [filter.op === "isNull" ? "equals" : "not"]: value } };
  }

  if (filter.op === "in" || filter.op === "notIn") {
    const values = parseFieldValue({
      field,
      isList: true,
      schema: z.array(scalarSchema(field)),
      value: filter.value,
    });

    return { [field.name]: { [filter.op]: values } };
  }

  const parsed = fieldValue({ field, value: filter.value });
  const value = field.type === "Json" && parsed === null ? AnyNull : parsed;
  const op = prismaOp(filter.op);
  return { [field.name]: { [op]: value } };
}

export function staffWhere({ model, filters }: { model: DatabaseModel; filters: StaffFilter[] }) {
  return { AND: filters.map((filter) => filterWhere({ filter, model })) };
}

export function staffId({ model, id }: { model: DatabaseModel; id: unknown }) {
  const primary = readableFields(model).find((field) => field.isId);

  if (!primary) {
    throw new StaffInputError(
      "This model has no single-field primary key. Use list with filters instead.",
    );
  }

  return { [primary.name]: fieldValue({ field: primary, value: id }) };
}

export function staffOrder({
  model,
  orderBy,
}: {
  model: DatabaseModel;
  orderBy?: { field: string; direction: "asc" | "desc" };
}) {
  if (orderBy) {
    const field = requireField({ model, name: orderBy.field });

    if (field.isList || field.type === "Json" || field.type === "Bytes") {
      throw new StaffInputError(
        `Field cannot be sorted. Valid fields: ${readableFields(model)
          .filter((entry) => !entry.isList && !["Json", "Bytes"].includes(entry.type))
          .map((entry) => entry.name)
          .join(", ")}`,
      );
    }
  }

  const primary = readableFields(model).filter(
    (field) => field.isId || model.primaryKey.some((name) => name === field.name),
  );

  return [
    ...(orderBy ? [{ [orderBy.field]: orderBy.direction }] : []),
    ...primary
      .filter((field) => field.name !== orderBy?.field)
      .map((field) => ({ [field.name]: "asc" })),
  ];
}

type StaffDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  count: (args: Record<string, unknown>) => Promise<number>;
};

export function staffDelegate({
  client,
  model,
}: {
  client: TransactionClient;
  model: DatabaseModel;
}) {
  const key = model.name.slice(0, 1).toLowerCase() + model.name.slice(1);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Prisma's per-model signatures share these three operations.
  return Reflect.get(client, key) as StaffDelegate;
}

export function staffSelect(model: DatabaseModel) {
  return Object.fromEntries(readableFields(model).map((field) => [field.name, true]));
}

function prismaOp(op: string) {
  if (op === "eq") {
    return "equals";
  }

  return op === "ne" ? "not" : op;
}
