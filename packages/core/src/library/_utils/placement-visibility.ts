import { type LibraryVisibility } from "@zoonk/db";

type Placed = { ownerId: string | null; visibility: LibraryVisibility };

export function assertPlacementVisibility({
  child,
  container,
}: {
  child: Placed;
  container: Placed;
}): void {
  if (child.visibility === "public") {
    return;
  }

  if (container.visibility !== "private" || container.ownerId !== child.ownerId) {
    throw new Error("Private content can only be placed in its owner's private content.");
  }
}

/** Canonical homes must match owner and visibility exactly; use `assertPlacementVisibility` for reused placements. */
export function assertHomeVisibility({ child, home }: { child: Placed; home: Placed }): void {
  const sameOwner = child.visibility === "public" || child.ownerId === home.ownerId;

  if (child.visibility !== home.visibility || !sameOwner) {
    throw new Error("Content's home must have the same visibility and owner as the content.");
  }
}
