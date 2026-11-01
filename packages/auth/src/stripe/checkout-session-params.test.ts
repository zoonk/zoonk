import { describe, expect, it } from "vitest";
import { getCheckoutSessionParams } from "./checkout-session-params";

describe(getCheckoutSessionParams, () => {
  it("uses the page's language for the renewal note", async () => {
    const params = await getCheckoutSessionParams({ annual: true, locale: "pt-BR" });

    expect(params.custom_text).toMatchObject({
      submit: { message: expect.stringContaining("todo ano") },
    });

    expect(params.consent_collection).toBeUndefined();
    expect(params.custom_text?.terms_of_service_acceptance).toBeUndefined();
  });

  it("uses a translated language the site doesn't offer yet", async () => {
    const params = await getCheckoutSessionParams({ annual: false, locale: "ja" });

    expect(params.custom_text).toMatchObject({
      submit: { message: expect.stringContaining("毎月") },
    });
  });
});
