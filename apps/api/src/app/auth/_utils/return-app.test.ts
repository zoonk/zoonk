import { MAIN_URL } from "@zoonk/utils/url";
import { describe, expect, it } from "vitest";
import { getReturnAppUrl } from "./return-app";

describe(getReturnAppUrl, () => {
  it("goes back to the Zoonk app that started the sign-in", () => {
    expect(getReturnAppUrl("https://admin.zoonk.com/auth/callback?state=abc")).toBe(
      "https://admin.zoonk.com",
    );

    expect(
      getReturnAppUrl("https://zoonk-admin-git-learning-v2-zoonk.vercel.app/auth/callback"),
    ).toBe("https://zoonk-admin-git-learning-v2-zoonk.vercel.app");
  });

  it("goes to this environment's main app without a Zoonk app to go back to", () => {
    expect(getReturnAppUrl(null)).toBe(MAIN_URL);
    expect(getReturnAppUrl("not a url")).toBe(MAIN_URL);
    expect(getReturnAppUrl("https://zoonk.com.evil.example/auth/callback")).toBe(MAIN_URL);
    expect(getReturnAppUrl("data:text/html,hello")).toBe(MAIN_URL);
  });
});
