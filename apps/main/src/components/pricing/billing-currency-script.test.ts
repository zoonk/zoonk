import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { BILLING_CURRENCY_SCRIPT } from "./billing-currency-script";

/** Runs the script as a page would, as the first child of its scope, with `cookie`. */
function runScript(cookie: string): string | undefined {
  const attributes = new Map<string, string>();

  const scope = { setAttribute: (name: string, value: string) => attributes.set(name, value) };

  runInNewContext(BILLING_CURRENCY_SCRIPT, {
    document: { cookie, currentScript: { parentNode: scope } },
  });

  return attributes.get("data-billing-currency");
}

describe("the billing currency script", () => {
  it("picks the currency of the visitor's country", () => {
    expect(runScript("zoonk-country=BR")).toBe("brl");
    expect(runScript("theme=dark; zoonk-country=DE; other=1")).toBe("eur");
    expect(runScript("zoonk-country=gb")).toBe("gbp");
  });

  it("bills in dollars a country without a currency of its own, or a visitor without the cookie", () => {
    expect(runScript("zoonk-country=ZZ")).toBe("usd");
    expect(runScript("")).toBe("usd");
    expect(runScript("my-zoonk-country=BR")).toBe("usd");
  });
});
