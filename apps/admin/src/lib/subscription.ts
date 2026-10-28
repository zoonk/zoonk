export const subscriptionFilters = ["all", "active", "canceled", "incomplete"] as const;

export type SubscriptionFilter = (typeof subscriptionFilters)[number];

export const subscriptionFilterLabels: Record<SubscriptionFilter, string> = {
  active: "Active",
  all: "All",
  canceled: "Canceled",
  incomplete: "Incomplete",
};

export function parseSubscriptionFilter(status: string | string[] | undefined): SubscriptionFilter {
  const value = Array.isArray(status) ? status[0] : status;

  if (isSubscriptionFilter(value)) {
    return value;
  }

  return "all";
}

export function getSubscriptionStatusLabel(status: string | null) {
  return status ? status.replaceAll("_", " ") : "—";
}

export function getSubscriptionProviderLabel(provider: string) {
  if (provider === "apple") {
    return "Apple";
  }

  if (provider === "google") {
    return "Google";
  }

  if (provider === "stripe") {
    return "Stripe";
  }

  return "Zoonk";
}

function isSubscriptionFilter(value: string | undefined): value is SubscriptionFilter {
  return subscriptionFilters.some((filter) => filter === value);
}
