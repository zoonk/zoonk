import { randomUUID } from "node:crypto";
import { sendPlusRenewalReminderEmail } from "@zoonk/auth/plus-emails";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listDueRenewalReminders, sendRenewalReminder } from "./renewal-reminders";

const stripe = vi.hoisted(() => ({ preview: vi.fn(), retrieve: vi.fn() }));

// Stripe and the mailer are external services; the subscription rows are real.
vi.mock("@zoonk/auth/stripe-client", () => ({
  stripeClient: {
    invoices: { createPreview: stripe.preview },
    subscriptions: { retrieve: stripe.retrieve },
  },
}));

vi.mock("@zoonk/auth/plus-emails", () => ({ sendPlusRenewalReminderEmail: vi.fn() }));

const DAY_MS = 86_400_000;

async function yearlySubscriber({
  cancelAtPeriodEnd = false,
  renewsInDays,
}: {
  cancelAtPeriodEnd?: boolean;
  renewsInDays: number;
}) {
  const user = await userFixture();
  // Stripe keeps whole seconds.
  const periodEnd = new Date(Math.floor((Date.now() + renewsInDays * DAY_MS) / 1000) * 1000);
  const stripeSubscriptionId = `sub_${randomUUID()}`;

  const subscription = await prisma.subscription.create({
    data: {
      cancelAtPeriodEnd,
      periodEnd,
      periodStart: new Date(periodEnd.getTime() - 365 * DAY_MS),
      plan: "plus",
      provider: "stripe",
      referenceId: user.id,
      status: "active",
      stripeSubscriptionId,
    },
  });

  const stripeSubscription = {
    cancel_at: null,
    cancel_at_period_end: cancelAtPeriodEnd,
    id: stripeSubscriptionId,
    items: {
      data: [
        {
          current_period_end: Math.floor(periodEnd.getTime() / 1000),
          price: { recurring: { interval: "year" } },
        },
      ],
    },
    metadata: { locale: "fr", timeZone: "Europe/Paris" },
    status: "active",
  };

  stripe.retrieve.mockResolvedValue(stripeSubscription);

  return { stripeSubscription, subscription, user };
}

describe("yearly renewal reminders", () => {
  beforeEach(() => {
    stripe.preview.mockResolvedValue({ amount_due: 5999, currency: "eur" });
  });

  it("are due 32 to 45 days before a renewal that isn't stopped", async () => {
    const [due, tooSoon, tooEarly, stopped] = await Promise.all([
      yearlySubscriber({ renewsInDays: 40 }),
      yearlySubscriber({ renewsInDays: 20 }),
      yearlySubscriber({ renewsInDays: 60 }),
      yearlySubscriber({ cancelAtPeriodEnd: true, renewsInDays: 40 }),
    ]);

    const dueIds = await listDueRenewalReminders();

    expect(dueIds).toContain(due.subscription.id);
    expect(dueIds).not.toContain(tooSoon.subscription.id);
    expect(dueIds).not.toContain(tooEarly.subscription.id);
    expect(dueIds).not.toContain(stopped.subscription.id);
  });

  it("emails the renewal date and Stripe's next charge once per renewal", async () => {
    const { subscription, user } = await yearlySubscriber({ renewsInDays: 40 });

    await expect(sendRenewalReminder(subscription.id)).resolves.toBe(true);

    expect(sendPlusRenewalReminderEmail).toHaveBeenCalledExactlyOnceWith({
      email: user.email,
      locale: "fr",
      renewal: { amount: 5999, currency: "eur", date: subscription.periodEnd },
      timeZone: "Europe/Paris",
    });

    await expect(sendRenewalReminder(subscription.id)).resolves.toBe(false);
    expect(sendPlusRenewalReminderEmail).toHaveBeenCalledOnce();
    await expect(listDueRenewalReminders()).resolves.not.toContain(subscription.id);
  });

  it("is due again for next year's renewal", async () => {
    const { subscription } = await yearlySubscriber({ renewsInDays: 40 });

    await prisma.subscription.update({
      data: { renewalReminderSentFor: new Date(Date.now() - 325 * DAY_MS) },
      where: { id: subscription.id },
    });

    await expect(listDueRenewalReminders()).resolves.toContain(subscription.id);
  });

  it("records nothing when the email fails, so the step's retry sends it", async () => {
    const { subscription } = await yearlySubscriber({ renewsInDays: 40 });
    vi.mocked(sendPlusRenewalReminderEmail).mockRejectedValueOnce(new Error("Mailer down"));

    await expect(sendRenewalReminder(subscription.id)).rejects.toThrow("Mailer down");
    await expect(listDueRenewalReminders()).resolves.toContain(subscription.id);
    await expect(sendRenewalReminder(subscription.id)).resolves.toBe(true);
  });

  it("skips a renewal Stripe already stopped, though ours hasn't heard yet", async () => {
    const { stripeSubscription, subscription } = await yearlySubscriber({ renewsInDays: 40 });
    stripe.retrieve.mockResolvedValueOnce({ ...stripeSubscription, cancel_at_period_end: true });

    await expect(sendRenewalReminder(subscription.id)).resolves.toBe(false);
    expect(sendPlusRenewalReminderEmail).not.toHaveBeenCalled();
  });
});
