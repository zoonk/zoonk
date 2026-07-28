import { type z } from "zod";

/**
 * Validates dynamic route segments at the HTTP boundary because Next.js route
 * params are untrusted strings even when TypeScript knows their names.
 */
export function parsePathParams<TOutput>({
  params,
  schema,
}: {
  params: unknown;
  schema: z.ZodType<TOutput>;
}): { data: TOutput; success: true } | { error: z.ZodError; success: false } {
  const result = schema.safeParse(params);

  return result.success
    ? { data: result.data, success: true }
    : { error: result.error, success: false };
}
