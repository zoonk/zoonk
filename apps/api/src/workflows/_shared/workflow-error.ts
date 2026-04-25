import { isJsonObject } from "@zoonk/utils/json";

export type WorkflowErrorLog = {
  errors?: WorkflowErrorLog[];
  message: string;
  name: string;
  stack?: string;
};

/**
 * Reads string properties from non-Error thrown values. Some provider and SDK
 * failures cross boundaries as plain objects, and preserving their `message`,
 * `name`, and `stack` fields is more useful than logging a generic JSON blob.
 */
function getStringProperty(value: unknown, key: string): string | undefined {
  if (!isJsonObject(value) || !(key in value)) {
    return undefined;
  }

  const property = value[key];

  return typeof property === "string" ? property : undefined;
}

/**
 * Reads nested errors from AggregateError-like values. Workflow serialization
 * may preserve an AggregateError as a plain object, so this accepts any object
 * with an array-shaped `errors` field.
 */
function getErrorsProperty(value: unknown): unknown[] | undefined {
  if (!isJsonObject(value) || !("errors" in value)) {
    return undefined;
  }

  return Array.isArray(value.errors) ? value.errors : undefined;
}

/**
 * Stringifies unusual thrown values without letting logging serialization become
 * a second workflow failure. This handles circular objects and values like
 * BigInt that `JSON.stringify` cannot encode.
 */
function stringifyUnknownError(error: unknown): string {
  try {
    const serialized = JSON.stringify(error);
    return serialized ?? String(error);
  } catch {
    return String(error);
  }
}

/**
 * Converts an unknown thrown value into a plain object that can cross workflow
 * step boundaries. Workflow steps persist arguments, so passing raw `Error`
 * instances is fragile; this keeps the original AI/provider message visible in
 * final failure logs without changing the thrown error itself.
 */
export function serializeWorkflowError(error: unknown): WorkflowErrorLog {
  if (error instanceof Error) {
    const errors = getErrorsProperty(error);

    return {
      ...(errors
        ? { errors: errors.map((nestedError) => serializeWorkflowError(nestedError)) }
        : {}),
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { message: error, name: "Error" };
  }

  const message = getStringProperty(error, "message");

  if (message) {
    const errors = getErrorsProperty(error);

    return {
      ...(errors
        ? { errors: errors.map((nestedError) => serializeWorkflowError(nestedError)) }
        : {}),
      message,
      name: getStringProperty(error, "name") ?? "Error",
      stack: getStringProperty(error, "stack"),
    };
  }

  return { message: stringifyUnknownError(error), name: "Error" };
}
