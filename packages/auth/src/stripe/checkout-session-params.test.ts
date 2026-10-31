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
});
