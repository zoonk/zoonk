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

export function libraryRowsVisibleTo(viewerId: string | null) {
  return viewerId
    ? { OR: [{ visibility: "public" as const }, { ownerId: viewerId }] }
    : { visibility: "public" as const };
}

export async function canViewLibraryRow(row: VisibleRow): Promise<boolean> {
  if (row.visibility === "public") {
    return true;
  }

  return isVisibleTo({ row, viewerId: await getViewerId() });
}

/** Apply after the shared cache: cached rows are not filtered for a particular viewer. */
export async function filterVisibleLibraryRows<T extends VisibleRow>(
  rows: readonly T[],
): Promise<T[]> {
  if (rows.every((row) => row.visibility === "public")) {
    return [...rows];
  }

  const viewerId = await getViewerId();
  return rows.filter((row) => isVisibleTo({ row, viewerId }));
}
