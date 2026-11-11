import { z } from "zod";

const DEFAULT_LIMIT = 20;
export const staffIntegerMax = 2_147_483_647;
const staffLimit = z.int().min(1).max(100).default(DEFAULT_LIMIT);

const filterOps = [
  "eq",
  "ne",
  "in",
  "notIn",
  "isNull",
  "notNull",
  "gt",
  "gte",
  "lt",
  "lte",
] as const;

const staffFilterSchema = z.strictObject({
  field: z.string(),
  op: z.enum(filterOps),
  value: z.json().optional(),
});

const filters = z.array(staffFilterSchema).default([]);
const model = z.string().min(1);

export const staffGetSchema = z.strictObject({ id: z.json(), model });
export const staffCountSchema = z.strictObject({ model, where: filters });
export const staffListSchema = z.strictObject({
  limit: staffLimit,
  model,
  offset: z.int().min(0).max(staffIntegerMax).default(0),
  orderBy: z.strictObject({ direction: z.enum(["asc", "desc"]), field: z.string() }).optional(),
  where: filters,
});
export const staffFindUserSchema = z.strictObject({ query: z.string().trim().min(1) });
export const staffSearchUsersSchema = z.strictObject({
  limit: staffLimit,
  query: z.string().min(1),
});

export type StaffFilter = z.infer<typeof staffFilterSchema>;

export class StaffInputError extends Error {
  override name = "StaffInputError";
}

export function parseStaffInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new StaffInputError(
      parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; "),
    );
  }

  return parsed.data;
}
