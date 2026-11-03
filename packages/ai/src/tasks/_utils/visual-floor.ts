/**
 * Every lesson shows a visual on about one teaching screen in three, at every level. A shared lesson
 * also opens on its story's picture. A private lesson's pictures serve one learner, so its floor is
 * met with what the app draws where it can, and class material brings its own figures.
 */
export type VisualFloor = "pictures" | "drawn" | "none";

export function getVisualFloor({
  isPrivate,
  material,
}: {
  isPrivate?: boolean;
  material?: string;
}): VisualFloor {
  if (material) {
    return "none";
  }

  return isPrivate ? "drawn" : "pictures";
}
