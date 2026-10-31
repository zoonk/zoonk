import { sendEmail } from "@zoonk/mailer";
import { describe, expect, it, vi } from "vitest";
import { sendPlusCancellationEmail, sendPlusPurchaseEmail } from "./plus-emails";

// Email delivery is external; render the real templates and inspect the payload sent to the mailer.
vi.mock("@zoonk/mailer", () => ({ sendEmail: vi.fn().mockResolvedValue({}) }));

describe("Plus email formatting", () => {
  it("formats Spanish prices, dates and cancellation times the Mexican way", async () => {
    const receivedAt = new Date("2026-09-27T14:30:00Z");

    await sendPlusCancellationEmail({
      choice: "withdrawal",
      email: "spanish-format@zoonk.test",
      endsAt: receivedAt,
      interval: "month",
      lateWithdrawal: false,
      locale: "es",
      name: "María",
      reason: null,
      receivedAt,
      refund: { amount: 123_456, currency: "USD" },
      refundableUntil: null,
    });

    const email = vi.mocked(sendEmail).mock.lastCall?.[0];

    expect(email?.htmlBody).toContain("1,234.56");
    expect(email?.htmlBody).toContain("27 de septiembre de 2026");
    expect(email?.htmlBody).toContain("2:30:00 p.m.");
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
    });

    const email = vi.mocked(sendEmail).mock.lastCall?.[0];

    expect(email?.htmlBody).toContain("1,234.56");
    expect(email?.htmlBody).toContain("September 27, 2026");
  });
});
