import { z } from "zod";

export const errorSchema = z
  .object({
    error: z.object({
      code: z
        .string()
        .meta({
          description:
            "Stable machine-readable error code. Clients must preserve unknown codes for forward compatibility.",
          examples: ["VALIDATION_ERROR"],
        }),
      details: z.unknown().optional().meta({ description: "Additional error details" }),
      message: z.string().meta({ description: "Error message" }),
    }),
  })
  .meta({ description: "Standard error response", id: "Error" });

export const paginationSchema = z
  .object({
    hasMore: z.boolean().meta({ description: "Whether more results exist" }),
    nextCursor: z.string().nullable().meta({ description: "Cursor for next page" }),
  })
  .meta({ id: "Pagination" });
