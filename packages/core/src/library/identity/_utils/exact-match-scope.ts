import { type LibraryVisibility } from "@zoonk/db";

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
