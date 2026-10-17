import { type LibraryVisibility } from "@zoonk/db";

/**
 * Keys are already scoped per owner; this also checks the row itself, so a
 * row written with the wrong visibility is never handed to another learner.
 */
export function isInRequestScope({
  ownerId,
  row,
}: {
  ownerId: string | null | undefined;
  row: { ownerId: string | null; visibility: LibraryVisibility };
}): boolean {
  if (ownerId) {
    return row.visibility === "private" && row.ownerId === ownerId;
  }

  return row.visibility === "public";
}
