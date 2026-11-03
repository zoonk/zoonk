import {
  type JSONSchema7,
  NoObjectGeneratedError,
  Output,
  type OutputInterface,
  zodSchema,
} from "ai";
import { z } from "zod";

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

function stripFences(text: string): string {
  const trimmed = text.trim();
  return /^```(?:json)?\s*(?<json>[\s\S]*?)\s*```$/u.exec(trimmed)?.groups?.json ?? trimmed;
}

function formatOutputRules(schema: z.ZodType): string {
  const { $schema: _version, ...jsonSchema } = z.toJSONSchema(schema, { reused: "ref" });

  return `# Output format

Answer with one JSON object and nothing else: no Markdown fences and no text before or after it. It follows this JSON Schema: write every property, with null where the schema allows null and there is nothing to give.

${JSON.stringify(jsonSchema)}`;
}

/**
 * Strict decoding can't take the lesson writer's schema everywhere: Anthropic compiles it into a
 * grammar that holds at most 16 nullable or union fields and refuses it as too large even without
 * them, and Gemini refuses its array bounds (Claude Opus 5.5 and Gemini 3.8 Flash, 3 Nov 2026). So
 * the schema goes in the system prompt (`outputRules`), the request asks for JSON without one, which
 * every provider accepts, and code validates the answer. A key left out reads as null when null is a
 * value it takes; any other flaw fails the call, and the step retries it.
 */
export function schemaInPrompt<OBJECT>(schema: z.ZodType<OBJECT>): {
  output: OutputInterface<OBJECT, unknown, never>;
  outputRules: string;
} {
  const json = Output.json();
  const inlineSchema = zodSchema(schema).jsonSchema;

  return {
    output: {
      ...json,
      async parseCompleteOutput({ text }, context) {
        const fail = (cause: Error) =>
          new NoObjectGeneratedError({
            cause,
            finishReason: context.finishReason,
            message: "No object generated: response did not match schema.",
            response: context.response,
            text,
            usage: context.usage,
          });

        let value: unknown;

        try {
          value = JSON.parse(stripFences(text));
        } catch (error) {
          throw fail(error instanceof Error ? error : new Error(String(error)));
        }

        const result = await schema.safeParseAsync(fillOmittedNulls(value, await inlineSchema));

        if (!result.success) {
          throw fail(result.error);
        }

        return result.data;
      },
    },
    outputRules: formatOutputRules(schema),
  };
}
