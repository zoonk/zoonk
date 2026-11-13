import { CliError, EXIT_CODES } from "./errors.ts";
import { isRecord } from "./http.ts";

export type OutputShape =
  | { fields: string[]; kind: "fields" }
  | { kind: "models"; names: string[] };

function pickFields(record: unknown, fields: string[]): unknown {
  if (!isRecord(record)) {
    return record;
  }

  const missing = fields.filter((field) => !(field in record));

  if (missing.length > 0) {
    throw new CliError(
      `--fields names ${missing.join(", ")}, which these records don't have. ` +
        `Fields: ${Object.keys(record).join(", ")}.`,
      EXIT_CODES.usage,
    );
  }

  return Object.fromEntries(fields.map((field) => [field, record[field]]));
}

function shapeRecords(body: Record<string, unknown>, fields: string[]) {
  if (Array.isArray(body.records)) {
    return { ...body, records: body.records.map((record) => pickFields(record, fields)) };
  }

  return { ...body, record: pickFields(body.record, fields) };
}

function shapeModels(body: Record<string, unknown>, names: string[]) {
  const models = Array.isArray(body.models) ? body.models.filter((model) => isRecord(model)) : [];

  if (names.length === 0) {
    return { models: models.map((model) => model.name) };
  }

  const unknown = names.filter((name) => !models.some((model) => model.name === name));

  if (unknown.length > 0) {
    throw new CliError(
      `No model named ${unknown.join(", ")}. Run \`pnpm zoonk staff models\` to list the ones you can read.`,
      EXIT_CODES.usage,
    );
  }

  return { models: models.filter((model) => names.includes(String(model.name))) };
}

export function shapeOutput({
  body,
  shape,
}: {
  body: Record<string, unknown>;
  shape?: OutputShape;
}): unknown {
  if (!shape) {
    return body;
  }

  return shape.kind === "fields"
    ? shapeRecords(body, shape.fields)
    : shapeModels(body, shape.names);
}
