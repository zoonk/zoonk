import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { z } from "zod";
import { resolveAudioMediaType } from "./audio-media-type";

/** `withApiErrorBoundary` answers it with `VALIDATION_ERROR`. */
export class InvalidRequestError extends Error {
  readonly zodError: z.ZodError;

  constructor(zodError: z.ZodError) {
    super("Invalid request");
    this.name = "InvalidRequestError";
    this.zodError = zodError;
  }
}

function refuse(message: string): InvalidRequestError {
  return new InvalidRequestError(new z.ZodError([{ code: "custom", message, path: [] }]));
}

/** Deeper than any request schema nests, so Zod refuses what lies below it. */
const MAX_ID_DEPTH = 32;

function lowercaseUuids(value: unknown, depth = 0): unknown {
  if (isUuid(value)) {
    return value.toLowerCase();
  }

  if (depth === MAX_ID_DEPTH) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => lowercaseUuids(item, depth + 1));
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, lowercaseUuids(item, depth + 1)]),
    );
  }

  return value;
}

/**
 * Ids reach core lowercase, as the database returns them: core and Prisma's batched `findUnique`
 * match ids with `===`, while clients may send any case.
 */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(lowercaseUuids(input));

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

  // HTTP adapters can expose a nonnull stream with zero bytes for a bodyless POST.
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

  const bytes = new Uint8Array(await audio.arrayBuffer());

  return {
    audio: { bytes, mediaType: resolveAudioMediaType({ bytes, declared: audio.type }) },
    fields,
  };
}
