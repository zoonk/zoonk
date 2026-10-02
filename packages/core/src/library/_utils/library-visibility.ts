import "server-only";
import { type LibraryVisibility } from "@zoonk/db";
import { getSession } from "../../users/get-session";

type VisibleRow = { ownerId: string | null; visibility: LibraryVisibility };

function isVisibleTo({ row, viewerId }: { row: VisibleRow; viewerId: string | null }): boolean {
  return row.visibility === "public" || (viewerId !== null && row.ownerId === viewerId);
}

async function getViewerId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}

/** A Prisma filter for rows a viewer may read: public ones and, with a viewer, their own private ones. */
export function libraryRowsVisibleTo(viewerId: string | null) {
  return viewerId
    ? { OR: [{ visibility: "public" as const }, { ownerId: viewerId }] }
    : { visibility: "public" as const };
}

/**
 * Private content is built for one learner's too-specific goal and is never
 * shown to anyone else. Public rows skip the session lookup, so shared content
 * stays readable by visitors and cacheable.
 */
export async function canViewLibraryRow(row: VisibleRow): Promise<boolean> {
  if (row.visibility === "public") {
    return true;
  }

  return isVisibleTo({ row, viewerId: await getViewerId() });
}

/**
 * Removes private rows the viewer doesn't own from a list, reading the session
 * only when the list has a private row. Cached reads return every row and call
 * this after the cache, because the cache is shared by all viewers.
 */
export async function filterVisibleLibraryRows<T extends VisibleRow>(
  rows: readonly T[],
): Promise<T[]> {
  if (rows.every((row) => row.visibility === "public")) {
    return [...rows];
  }

  const viewerId = await getViewerId();
  return rows.filter((row) => isVisibleTo({ row, viewerId }));
}
