import { prisma } from "@zoonk/db";

function seconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** E2E uses fake Stripe keys and test-owned subscriptions; payment requests must stay local. */
export async function stripeE2EFetch(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const id = url.pathname.split("/").at(-1);
  const method = init?.method ?? "GET";
  const body = new URLSearchParams(typeof init?.body === "string" ? init.body : "");

  if (
    !url.pathname.startsWith("/v1/subscriptions/sub_test_e2e_") ||
    (method !== "GET" && (method !== "POST" || body.get("cancel_at_period_end") !== "true"))
  ) {
    throw new Error(`Unsupported E2E Stripe request: ${method} ${url.pathname}`);
  }

  const subscription = await prisma.subscription.findFirstOrThrow({
    where: { stripeSubscriptionId: id },
  });

  if (!subscription.periodStart || !subscription.periodEnd) {
    throw new Error("E2E Stripe subscriptions need a billing period");
  }

  const cancelAt = method === "POST" ? subscription.periodEnd : subscription.cancelAt;

  return Response.json({
    cancel_at: cancelAt ? seconds(cancelAt) : null,
    cancel_at_period_end: method === "POST" || subscription.cancelAtPeriodEnd,
    canceled_at: method === "POST" ? Math.floor(Date.now() / 1000) : null,
    ended_at: null,
    id,
    items: {
      data: [
        {
          current_period_end: seconds(subscription.periodEnd),
          current_period_start: seconds(subscription.periodStart),
          id: `si_${id}`,
          price: { recurring: { interval: "month" } },
        },
      ],
    },
    latest_invoice: {
      amount_paid: 1000,
      currency: "usd",
      id: `in_${id}`,
      lines: {
        data: [
          {
            parent: {
              subscription_item_details: { proration: false, subscription_item: `si_${id}` },
            },
            period: {
              end: seconds(subscription.periodEnd),
              start: seconds(subscription.periodStart),
            },
          },
        ],
      },
      status: "paid",
    },
    start_date: seconds(subscription.periodStart),
    status: subscription.status,
  });
}
