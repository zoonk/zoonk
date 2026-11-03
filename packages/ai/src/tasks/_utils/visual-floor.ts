/**
 * Shared lessons show a visual on about one teaching screen in three at every level, starting with
 * the hook's picture. A private lesson's pictures serve one learner, so it shows what the app draws
 * instead, and class material brings its own figures.
 */
export function hasVisualFloor({
  isPrivate,
  material,
}: {
  isPrivate?: boolean;
  material?: string;
}): boolean {
  return !isPrivate && !material;
}
