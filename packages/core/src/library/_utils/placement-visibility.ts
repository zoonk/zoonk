import { type LibraryVisibility } from "@zoonk/db";

type Placed = { ownerId: string | null; visibility: LibraryVisibility };

/**
 * Private content is never listed publicly, so it can only be placed inside a
 * container that is private to the same owner. Public content can go anywhere:
 * a private course reuses shared chapters for the general parts of a goal.
 */
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

/**
 * A home gives content its canonical URL, which search engines and shared
 * links follow. Shared content never gets a private home, or its URL would
 * point into one learner's course, so the home must match the content exactly.
 */
export function assertHomeVisibility({ child, home }: { child: Placed; home: Placed }): void {
  const sameOwner = child.visibility === "public" || child.ownerId === home.ownerId;

  if (child.visibility !== home.visibility || !sameOwner) {
    throw new Error("Content's home must have the same visibility and owner as the content.");
  }
}
