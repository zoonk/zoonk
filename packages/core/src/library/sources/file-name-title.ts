/**
 * "L9784" or "l12813.htm": a page's file name standing in for its title, as Planalto titles its law
 * pages. A document's own name has a space, or no digit.
 */
export function isFileNameTitle(title: string): boolean {
  return !/\s/u.test(title.trim()) && /\d/u.test(title);
}
