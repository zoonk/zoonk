import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { USAGE_NOTICE_SCRIPT } from "./usage-notice-script";

/** Runs the script as `<head>` would, with the browser's cookies and time zone. */
function asksFirst({ cookie, timeZone }: { cookie: string; timeZone: string }): boolean {
  const attributes = new Set<string>();

  runInNewContext(USAGE_NOTICE_SCRIPT, {
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }) },
    document: {
      cookie,
      documentElement: {
        toggleAttribute: (name: string, on: boolean) =>
          on ? attributes.add(name) : attributes.delete(name),
      },
    },
  });

  return attributes.has("data-usage-notice");
}

describe("the usage notice script", () => {
  it("asks where the browser's country needs a yes, whatever its time zone", () => {
    expect(asksFirst({ cookie: "ZOONK_COUNTRY=DE", timeZone: "America/Sao_Paulo" })).toBe(true);
    expect(asksFirst({ cookie: "ZOONK_COUNTRY=BR", timeZone: "Europe/Berlin" })).toBe(false);
  });

  it("goes by the time zone before the browser knows its country", () => {
    expect(asksFirst({ cookie: "", timeZone: "Europe/Berlin" })).toBe(true);
    expect(asksFirst({ cookie: "", timeZone: "Europe/Istanbul" })).toBe(true);
    expect(asksFirst({ cookie: "", timeZone: "America/Sao_Paulo" })).toBe(false);
  });

  it("never asks once the visitor chose", () => {
    expect(asksFirst({ cookie: "ZOONK_COUNTRY=DE; ZOONK_USAGE_DATA=off", timeZone: "" })).toBe(
      false,
    );
  });

  it("ignores a cookie whose name only ends like the country's", () => {
    expect(asksFirst({ cookie: "MY_ZOONK_COUNTRY=DE", timeZone: "America/Sao_Paulo" })).toBe(false);
  });
});
