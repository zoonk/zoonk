import { sendEmail } from "@zoonk/mailer";
import { describe, expect, it, vi } from "vitest";
import {
  sendPlusCancellationEmail,
  sendPlusCancellationRequestEmail,
  sendPlusPurchaseEmail,
} from "./plus-emails";

// Email delivery is external; render the real templates and inspect the payload sent to the mailer.
vi.mock("@zoonk/mailer", () => ({ sendEmail: vi.fn().mockResolvedValue({}) }));

function lastEmail() {
  return vi.mocked(sendEmail).mock.lastCall?.[0];
}

const cancellation = {
  canKeepPlus: false,
  choice: "ordinary",
  email: "learner@zoonk.test",
  endsAt: new Date("2026-11-30T14:30:00Z"),
  interval: "month",
  locale: "en",
  name: "Ana",
  reason: null,
  receivedAt: new Date("2026-10-31T14:30:00Z"),
  refund: null,
  refundableUntil: null,
  source: "settings",
  timeZone: "UTC",
} as const;

describe("Plus email formatting", () => {
  it("formats Spanish prices, dates and cancellation times the Mexican way", async () => {
    const receivedAt = new Date("2026-09-27T14:30:00Z");

    await sendPlusCancellationEmail({
      ...cancellation,
      choice: "withdrawal",
      endsAt: receivedAt,
      locale: "es",
      name: "María",
      receivedAt,
      refund: { amount: 123_456, currency: "USD" },
    });

    expect(lastEmail()?.htmlBody).toContain("1,234.56");
    expect(lastEmail()?.htmlBody).toContain("27 de septiembre de 2026");
    expect(lastEmail()?.htmlBody).toContain("2:30:00 p.m.");
  });

  it("preserves English purchase formatting", async () => {
    const subscribedAt = new Date("2026-09-27T14:30:00Z");

    await sendPlusPurchaseEmail({
      email: "english-format@zoonk.test",
      interval: "month",
      locale: "en",
      paid: { amount: 123_456, currency: "USD" },
      renewal: { amount: 123_456, currency: "USD", date: subscribedAt },
      subscribedAt,
      timeZone: "UTC",
    });

    expect(lastEmail()?.htmlBody).toContain("1,234.56");
    expect(lastEmail()?.htmlBody).toContain("September 27, 2026");
  });

  it("gives the refund's last day where the learner subscribed, not in UTC", async () => {
    // 23:30 on October 1 in São Paulo is already October 2 in UTC.
    const subscribedAt = new Date("2026-10-02T02:30:00Z");

    await sendPlusPurchaseEmail({
      email: "brazil@zoonk.test",
      interval: "month",
      locale: "en",
      paid: { amount: 2990, currency: "BRL" },
      renewal: { amount: 2990, currency: "BRL", date: new Date("2026-11-02T02:30:00Z") },
      subscribedAt,
      timeZone: "America/Sao_Paulo",
    });

    expect(lastEmail()?.htmlBody).toContain("Until October 15, 2026, you can cancel");
    expect(lastEmail()?.htmlBody).toContain("on October 1, 2026");
  });
});

describe(sendPlusCancellationEmail, () => {
  it("offers Keep Plus to a learner who stopped the renewal in Settings", async () => {
    await sendPlusCancellationEmail({ ...cancellation, canKeepPlus: true });
    expect(lastEmail()?.htmlBody).toContain("Changed your mind? Choose Keep Plus in Zoonk");
  });

  it("doesn't offer Keep Plus once Plus can't be kept", async () => {
    await sendPlusCancellationEmail(cancellation);
    expect(lastEmail()?.htmlBody).not.toContain("Keep Plus");
  });

  it("confirms an account deletion that ended Plus with its refund", async () => {
    const receivedAt = new Date("2026-10-31T14:30:00Z");

    await sendPlusCancellationEmail({
      ...cancellation,
      choice: "withdrawal",
      endsAt: receivedAt,
      refund: { amount: 999, currency: "EUR" },
      source: "accountDeletion",
    });

    expect(lastEmail()?.htmlBody).toContain(
      "We received your request to delete your Zoonk account on October 31, 2026",
    );

    expect(lastEmail()?.htmlBody).toContain("refunded the full €9.99");
    expect(lastEmail()?.subject).toBe("Your Zoonk Plus subscription is canceled and refunded");
  });
});

describe(sendPlusCancellationRequestEmail, () => {
  it("tells the account's owner a request arrived, that nothing changes yet, and to reply if it wasn't them", async () => {
    await sendPlusCancellationRequestEmail({
      choice: "extraordinary",
      email: "learner@zoonk.test",
      locale: "en",
      name: "Someone",
      reason: "Moving abroad",
      receivedAt: new Date("2026-10-31T14:30:00Z"),
      timeZone: "UTC",
    });

    const email = lastEmail();

    expect(email?.to).toBe("learner@zoonk.test");
    expect(email?.htmlBody).toContain("October 31, 2026");
    expect(email?.htmlBody).toContain("End now for an important reason");
    expect(email?.htmlBody).toContain("Moving abroad");
    expect(email?.htmlBody).toContain("before anything changes");
    expect(email?.htmlBody).toContain("If it wasn&#39;t you, just reply to this email.");
  });
});
