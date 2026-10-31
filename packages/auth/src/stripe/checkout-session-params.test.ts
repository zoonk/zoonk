import { describe, expect, it } from "vitest";
import { getCheckoutSessionParams } from "./checkout-session-params";

describe(getCheckoutSessionParams, () => {
  it("writes the final screen in the language of the page the learner subscribed from", async () => {
    const params = await getCheckoutSessionParams({ annual: true, locale: "pt-BR" });

    expect(params.custom_text).toMatchObject({
      submit: { message: expect.stringContaining("todo ano") },
      terms_of_service_acceptance: {
        message: expect.stringMatching(/\[Termos de Serviço\]\(https?:\/\/[^)]+\/terms\)/u),
      },
    });
  });

  it("keeps the language and time zone on the subscription for its emails", async () => {
    const params = await getCheckoutSessionParams({
      annual: false,
      locale: "pt-BR",
      timeZone: "America/Sao_Paulo",
    });

    expect(params.subscription_data).toStrictEqual({
      metadata: { locale: "pt", timeZone: "America/Sao_Paulo" },
    });
  });

  it("keeps no time zone that doesn't exist", async () => {
    const params = await getCheckoutSessionParams({
      annual: false,
      locale: "en",
      timeZone: "Mars/Olympus",
    });

    expect(params.subscription_data).toStrictEqual({ metadata: { locale: "en" } });
  });

  it("writes it in a translated language the site doesn't offer yet", async () => {
    const params = await getCheckoutSessionParams({ annual: false, locale: "ja" });

    expect(params.custom_text).toMatchObject({
      submit: { message: expect.stringContaining("毎月") },
    });
  });
});
