import { capitalize, toWords } from "@/lib/format";

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
  return status ? toWords(status) : "—";
}

const STORES: Partial<Record<string, { name: string; where: string }>> = {
  apple: { name: "Apple", where: "App Store Connect" },
  google: { name: "Google", where: "Play Console" },
  stripe: { name: "Stripe", where: "the Stripe dashboard" },
};

/** Who charges for it. Zoonk's own are the ones staff give by hand, at no charge. */
export function getSubscriptionBilledBy({
  billingInterval,
  provider,
}: {
  billingInterval: string | null;
  provider: string;
}): string {
  const store = STORES[provider];

  if (!store) {
    return "Given by Zoonk, no charge";
  }

  return billingInterval ? `${store.name}, ${billingInterval}` : store.name;
}

/** Where a store-billed subscription is changed, since Admin can't. */
export function getSubscriptionStore(provider: string) {
  return STORES[provider] ?? null;
}

export function getPlanLabel(plan: string | null | undefined): string {
  return capitalize(plan ?? "free");
}

function isSubscriptionFilter(value: string | undefined): value is SubscriptionFilter {
  return subscriptionFilters.some((filter) => filter === value);
}
