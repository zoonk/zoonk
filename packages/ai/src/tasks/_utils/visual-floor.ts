/**
 * A lesson's audience decides its visuals: a shared lesson shows one on every teaching screen, and
 * one for a single learner, private or built from their class material, on one in two, met with
 * what the app draws where it can, since its pictures would serve that learner alone.
 */
export type VisualFloor = "pictures" | "drawn";

export function getVisualFloor({
  isPrivate,
  material,
}: {
  isPrivate?: boolean;
  material?: string;
}): VisualFloor {
  return isPrivate || material ? "drawn" : "pictures";
}
