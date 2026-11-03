import { describe, expect, it } from "vitest";
import {
  getCallbackHref,
  getLoginHref,
  getOtpHref,
  getSetupHref,
  readRedirectTo,
  readRedirectToParam,
} from "./auth-redirect";

const APP_CALLBACK = "http://localhost:3000/auth/callback?state=abc";

describe(readRedirectTo, () => {
  it("keeps one address and drops missing or repeated values", () => {
    expect(readRedirectTo(APP_CALLBACK)).toBe(APP_CALLBACK);
    expect(readRedirectTo()).toBeNull();
    expect(readRedirectTo("")).toBeNull();
    expect(readRedirectTo([APP_CALLBACK, APP_CALLBACK])).toBeNull();
  });
});

describe(readRedirectToParam, () => {
  it("reads one address from a query and refuses a repeated one", () => {
    const query = new URLSearchParams({ locale: "pt", redirectTo: APP_CALLBACK });

    expect(readRedirectToParam(query)).toBe(APP_CALLBACK);
    expect(readRedirectToParam(new URLSearchParams("locale=pt"))).toBeNull();

    query.append("redirectTo", APP_CALLBACK);
    expect(readRedirectToParam(query)).toBeNull();
  });
});

describe("auth hrefs", () => {
  it("carry the app's address forward, encoded", () => {
    const encoded = encodeURIComponent(APP_CALLBACK);

    expect(getCallbackHref(APP_CALLBACK)).toBe(`/auth/callback?redirectTo=${encoded}`);

    expect(getLoginHref({ locale: "pt", redirectTo: APP_CALLBACK })).toBe(
      `/auth/pt/login?redirectTo=${encoded}`,
    );

    expect(getSetupHref({ locale: "pt", redirectTo: APP_CALLBACK })).toBe(
      `/auth/pt/setup?redirectTo=${encoded}`,
    );

    expect(getOtpHref({ email: "ana@zoonk.test", locale: "pt", redirectTo: APP_CALLBACK })).toBe(
      `/auth/pt/otp?email=ana%40zoonk.test&redirectTo=${encoded}`,
    );
  });

  it("leave the address out when sign-in started on the API", () => {
    expect(getCallbackHref(null)).toBe("/auth/callback");
    expect(getLoginHref({ locale: "en", redirectTo: null })).toBe("/auth/en/login");
    expect(getSetupHref({ locale: "en", redirectTo: null })).toBe("/auth/en/setup");

    expect(getOtpHref({ email: "ana@zoonk.test", locale: "en", redirectTo: null })).toBe(
      "/auth/en/otp?email=ana%40zoonk.test",
    );
  });
});
