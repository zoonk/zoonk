export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];

/** Permission callers must supply a fresh clock and client. */
export function getActiveSubscriptionQuery({ now, userId }: { now: Date; userId: string }) {
  return {
    orderBy: { id: "desc" as const },
    where: {
      OR: [
        { provider: { notIn: ["apple" as const, "google" as const] } },
        { endedAt: null, periodEnd: { gt: now }, provider: "apple" as const },
        /**
         * Google keeps a renewing subscription through its renewal and the silent grace after a
         * failed payment, until a read of it says otherwise (`checkGooglePlayRenewal`); a canceled
         * one lapses at its period end.
         */
        {
          OR: [{ cancelAtPeriodEnd: false }, { periodEnd: { gt: now } }],
          endedAt: null,
          provider: "google" as const,
        },
      ],
      referenceId: userId,
      status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
    },
  };
}
