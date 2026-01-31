import { type z } from "zod";

export function parseQueryParams<TOutput>(
  searchParams: URLSearchParams,
  schema: z.ZodType<TOutput>,
): { data: TOutput; success: true } | { error: z.ZodError; success: false } {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);

  return result.success
    ? { data: result.data, success: true }
    : { error: result.error, success: false };
}
