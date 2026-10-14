/** A subject without a stated weight counts as the average stated subject, or one with none. */
export function getSubjectShareFallback(shares: readonly (number | null)[]): number {
  const stated = shares.filter((share): share is number => share !== null);
  return stated.length === 0 ? 1 : stated.reduce((sum, share) => sum + share, 0) / stated.length;
}
