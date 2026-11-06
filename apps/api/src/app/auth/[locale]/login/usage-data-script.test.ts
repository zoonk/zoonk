import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { USAGE_DATA_SCRIPT } from "./usage-data-script";

function cookieWrittenAt(search: string): string {
  const document = { cookie: "" };
  runInNewContext(USAGE_DATA_SCRIPT, { URLSearchParams, document, location: { search } });

  return document.cookie;
}

describe("the login page's usage-data script", () => {
  it("keeps the choice the main app passed on, for the sign-up and sign-in that follow", () => {
    expect(cookieWrittenAt("?locale=en&redirectTo=x&usageData=off")).toBe(
      "ZOONK_USAGE_DATA=off; path=/; max-age=31536000; samesite=lax",
    );

    expect(cookieWrittenAt("?usageData=on")).toBe(
      "ZOONK_USAGE_DATA=on; path=/; max-age=31536000; samesite=lax",
    );
  });

  it("writes nothing when the main app passed no choice it makes", () => {
    expect(cookieWrittenAt("?locale=en")).toBe("");
    expect(cookieWrittenAt("?usageData=maybe")).toBe("");
  });
});
