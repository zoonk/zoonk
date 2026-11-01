import { prisma } from "@zoonk/db";

function seconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function isSupportedRequest({
  method,
  resumes,
  stops,
  url,
}: {
  method: string;
  resumes: boolean;
  stops: boolean;
  url: URL;
}): boolean {
  if (!url.pathname.startsWith("/v1/subscriptions/sub_test_e2e_")) {
    return false;
  }

  return ["GET", "DELETE"].includes(method) || (method === "POST" && (stops || resumes));
}

/** E2E uses fake Stripe keys and test-owned subscriptions; payment requests must stay local. */
export async function stripeE2EFetch(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const id = url.pathname.split("/").at(-1);
  const method = init?.method ?? "GET";
  const body = new URLSearchParams(typeof init?.body === "string" ? init.body : "");

  const stops = body.get("cancel_at_period_end") === "true";
  const resumes = body.get("cancel_at") === "" || body.get("cancel_at_period_end") === "false";

  if (!isSupportedRequest({ method, resumes, stops, url })) {
    throw new Error(`Unsupported E2E Stripe request: ${method} ${url.pathname}`);
  }

  const subscription = await prisma.subscription.findFirstOrThrow({
    where: { stripeSubscriptionId: id },
  });

  if (!subscription.periodStart || !subscription.periodEnd) {
    throw new Error("E2E Stripe subscriptions need a billing period");
  }

  const updated = method === "POST";
  const ended = method === "DELETE";
  const stopped = !ended && (updated ? stops : subscription.cancelAtPeriodEnd);
  const cancelAt = updated ? stops && subscription.periodEnd : subscription.cancelAt;

  return Response.json({
    cancel_at: !ended && cancelAt ? seconds(cancelAt) : null,
    cancel_at_period_end: stopped,
    canceled_at: stops || ended ? Math.floor(Date.now() / 1000) : null,
    customer: `cus_${id}`,
    ended_at: ended ? Math.floor(Date.now() / 1000) : null,
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
    status: ended ? "canceled" : subscription.status,
  });
}
