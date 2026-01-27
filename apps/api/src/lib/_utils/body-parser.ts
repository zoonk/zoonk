import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";
import { z } from "zod";

export async function parseBody<TBody>(
  req: NextRequest,
  schema: z.ZodType<TBody>,
): Promise<{ data: TBody; success: true } | { error: z.ZodError; success: false }> {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- JSON parsing returns unknown
  const { data: json, error } = await safeAsync(() => req.json());

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
