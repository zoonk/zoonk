import { type JSONSchema7, type Schema, jsonSchema, zodSchema } from "ai";
import { type z } from "zod";

type Definition = JSONSchema7 | boolean | undefined;

function asNode(definition: Definition): JSONSchema7 | undefined {
  return typeof definition === "object" ? definition : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Zod writes `.nullable()` as `null` in the type or in `anyOf`. */
function acceptsNull(definition: Definition): boolean {
  const node = asNode(definition);
  const types = Array.isArray(node?.type) ? node.type : [node?.type];

  return types.includes("null") || (node?.anyOf ?? []).some((branch) => acceptsNull(branch));
}

function fitsBranch(node: JSONSchema7, value: unknown): boolean {
  if (Array.isArray(value)) {
    return node.type === "array";
  }

  if (!isRecord(value) || node.type !== "object") {
    return false;
  }

  return Object.entries(node.properties ?? {}).every(([key, property]) => {
    const constant = asNode(property)?.const;
    return constant === undefined || constant === value[key];
  });
}

function fillOmittedNulls(value: unknown, node: JSONSchema7): unknown {
  if (node.anyOf) {
    const [branch, ...others] = node.anyOf
      .map((definition) => asNode(definition))
      .filter((candidate) => candidate !== undefined && fitsBranch(candidate, value));

    return branch && others.length === 0 ? fillOmittedNulls(value, branch) : value;
  }

  if (Array.isArray(value)) {
    const items = Array.isArray(node.items) ? undefined : asNode(node.items);
    return items ? value.map((item) => fillOmittedNulls(item, items)) : value;
  }

  const { properties } = node;

  if (!isRecord(value) || !properties) {
    return value;
  }

  const omitted = (node.required ?? []).filter(
    (key) => !(key in value) && acceptsNull(properties[key]),
  );

  return Object.fromEntries([
    ...Object.entries(value).map(([key, field]) => {
      const property = asNode(properties[key]);
      return [key, property ? fillOmittedNulls(field, property) : field];
    }),
    ...omitted.map((key) => [key, null]),
  ]);
}

/**
 * Anthropic's strict decoding takes at most 16 nullable fields, so with a bigger schema it answers
 * without one and can leave keys out (Claude Opus 5.5 dropped every option's `picture`, 9 Oct
 * 2026). A key left out reads as null when null is a value it takes; any other still fails.
 */
export function acceptOmittedNulls<OBJECT>(schema: z.ZodType<OBJECT>): Schema<OBJECT> {
  const sent = zodSchema(schema);

  return jsonSchema<OBJECT>(() => sent.jsonSchema, {
    validate: async (value) => {
      const result = await schema.safeParseAsync(fillOmittedNulls(value, await sent.jsonSchema));

      return result.success
        ? { success: true, value: result.data }
        : { error: result.error, success: false };
    },
  });
}
