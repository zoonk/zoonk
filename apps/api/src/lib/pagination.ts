import { z } from "zod";

const cursorPayloadSchema = z.object({
  offset: z.number().int().min(0),
});

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url");
}

export function decodeCursor(cursor: string): number | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const json: unknown = JSON.parse(decoded);
    const result = cursorPayloadSchema.safeParse(json);

    return result.success ? result.data.offset : null;
  } catch {
    return null;
  }
}

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export function createPaginatedResponse<T>(
  items: T[],
  limit: number,
  offset: number,
  totalFetched: number,
): PaginatedResponse<T> {
  const hasMore = totalFetched > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextOffset = offset + data.length;

  return {
    data,
    pagination: {
      hasMore,
      nextCursor: hasMore ? encodeCursor(nextOffset) : null,
    },
  };
}
