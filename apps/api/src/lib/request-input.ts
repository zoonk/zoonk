import { safeAsync } from "@zoonk/utils/error";
import { z } from "zod";

/**
 * A request whose path, query or body doesn't match its schema. `withApiErrorBoundary` answers it
 * with `VALIDATION_ERROR`, so a route reads its input in one line and only handles its own cases.
 */
export class InvalidRequestError extends Error {
  readonly zodError: z.ZodError;

  constructor(zodError: z.ZodError) {
    super("Invalid request");
    this.name = "InvalidRequestError";
    this.zodError = zodError;
  }
}

/** A request input refused for a reason no schema states. */
function refuse(message: string): InvalidRequestError {
  return new InvalidRequestError(new z.ZodError([{ code: "custom", message, path: [] }]));
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new InvalidRequestError(result.error);
  }

  return result.data;
}

/** Route segments are untrusted strings even when TypeScript knows their names. */
export async function readPathParams<T>(
  context: { params: Promise<unknown> },
  schema: z.ZodType<T>,
): Promise<T> {
  return parseInput(schema, await context.params);
}

export function readQueryParams<T>(request: Request, schema: z.ZodType<T>): T {
  return parseInput(schema, Object.fromEntries(new URL(request.url).searchParams));
}

async function readJson(request: Request, emptyBody: unknown): Promise<unknown> {
  if (emptyBody === undefined) {
    return request.json();
  }

  /** HTTP adapters can expose a nonnull stream with zero bytes for a bodyless POST. */
  const body = await request.text();
  return body.length === 0 ? emptyBody : JSON.parse(body);
}

export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  options?: { emptyBody: unknown },
): Promise<T> {
  const { data, error } = await safeAsync(() => readJson(request, options?.emptyBody));

  if (error) {
    throw refuse("Invalid JSON body");
  }

  return parseInput(schema, data);
}

/**
 * A spoken answer's multipart body: the recording in its `audio` file field, and the other fields
 * as `schema` reads them.
 */
export async function readAudioForm<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ audio: { bytes: Uint8Array; mediaType: string }; fields: T }> {
  const { data: form } = await safeAsync(() => request.formData());
  const audio = form?.get("audio");

  if (!form || !(audio instanceof File)) {
    throw refuse("Send the recording as the `audio` file field");
  }

  const fields = parseInput(
    schema,
    Object.fromEntries([...form.entries()].filter(([name]) => name !== "audio")),
  );

  return {
    audio: { bytes: new Uint8Array(await audio.arrayBuffer()), mediaType: audio.type },
    fields,
  };
}
