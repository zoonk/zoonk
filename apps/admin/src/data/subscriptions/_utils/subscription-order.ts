/**
 * Billing periods provide the most useful recency signal, while UUID order
 * keeps incomplete rows without dates deterministic.
 */
export function getSubscriptionOrderBy() {
  return [
    { periodStart: { nulls: "last" as const, sort: "desc" as const } },
    { periodEnd: { nulls: "last" as const, sort: "desc" as const } },
    { id: "desc" as const },
  ];
}
