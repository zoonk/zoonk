import { z } from "zod";

const cursorPayloadSchema = z.object({ offset: z.number().int().min(0) });

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
  pagination: { nextCursor: string | null; hasMore: boolean };
};

/**
 * Converts a core-owned page outcome into the API cursor envelope. Core
 * decides whether more domain results exist; this adapter only keeps the
 * transport cursor aligned with the number of serialized items.
 */
export function createPaginatedResponse<T>({
  hasMore,
  items,
  offset,
}: {
  hasMore: boolean;
  items: T[];
  offset: number;
}): PaginatedResponse<T> {
  const nextOffset = offset + items.length;

  return {
    data: items,
    pagination: { hasMore, nextCursor: hasMore ? encodeCursor(nextOffset) : null },
  };
}
