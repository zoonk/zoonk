const MIN_BAR_SHARE = 0.2;

export function getTrendBarShares(values: readonly (number | null)[]): number[] {
  if (values.length < 2) {
    return [];
  }

  const peak = Math.max(1, ...values.map((value) => value ?? 0));

  return values.map((value) => Math.max(MIN_BAR_SHARE, (value ?? 0) / peak));
}
