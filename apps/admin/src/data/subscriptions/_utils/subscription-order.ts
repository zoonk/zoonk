export function getSubscriptionOrderBy() {
  return [
    { periodStart: { nulls: "last" as const, sort: "desc" as const } },
    { periodEnd: { nulls: "last" as const, sort: "desc" as const } },
    { id: "desc" as const },
  ];
}
