import { prisma } from "@zoonk/db";
import { stripeClient } from "./client";
import { sendPlusPurchaseEmail } from "./plus-emails";
import { readSubscriptionMetadata } from "./subscription-metadata";
import type Stripe from "stripe";

function getInvoiceId(subscription: Stripe.Subscription): string | null {
  const invoice = subscription.latest_invoice;
  return typeof invoice === "string" ? invoice : (invoice?.id ?? null);
}

/** The renewal price comes from Stripe's preview, so a promotion that ends after one period shows the real next charge. */
export async function sendPlusPurchaseConfirmation({
  referenceId,
  stripeSubscription,
}: {
  referenceId: string;
  stripeSubscription: Stripe.Subscription;
}): Promise<void> {
  const item = stripeSubscription.items.data[0];
  const invoiceId = getInvoiceId(stripeSubscription);

  if (!item || !invoiceId) {
    return;
  }

  const [user, invoice, renewal] = await Promise.all([
    prisma.user.findUnique({ select: { email: true }, where: { id: referenceId } }),
    stripeClient.invoices.retrieve(invoiceId),
    stripeClient.invoices.createPreview({ subscription: stripeSubscription.id }),
  ]);

  if (!user) {
    return;
  }

  await sendPlusPurchaseEmail({
    ...readSubscriptionMetadata(stripeSubscription.metadata),
    email: user.email,
    interval: item.price.recurring?.interval === "year" ? "year" : "month",
    paid: { amount: invoice.amount_paid, currency: invoice.currency },
    renewal: {
      amount: renewal.amount_due,
      currency: renewal.currency,
      date: new Date(item.current_period_end * 1000),
    },
    subscribedAt: new Date(stripeSubscription.start_date * 1000),
  });
}
