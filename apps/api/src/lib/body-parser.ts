import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";
import { z } from "zod";

async function readJsonBody({
  emptyBody,
  request,
}: {
  emptyBody?: unknown;
  request: NextRequest;
}): Promise<unknown> {
  if (emptyBody === undefined) {
    return request.json();
  }

  /** HTTP adapters can expose a nonnull stream with zero bytes for a bodyless POST. */
  const body = await request.text();
  return body.length === 0 ? emptyBody : JSON.parse(body);
}

export async function parseBody<TBody>(
  req: NextRequest,
  schema: z.ZodType<TBody>,
  options?: { emptyBody: unknown },
): Promise<{ data: TBody; success: true } | { error: z.ZodError; success: false }> {
  const { data: json, error } = await safeAsync<unknown>(() =>
    readJsonBody({ emptyBody: options?.emptyBody, request: req }),
  );

  if (error) {
    return {
      error: new z.ZodError([{ code: "custom", message: "Invalid JSON body", path: [] }]),
      success: false,
    };
  }

  const result = schema.safeParse(json);

  return result.success
    ? { data: result.data, success: true }
    : { error: result.error, success: false };
}
