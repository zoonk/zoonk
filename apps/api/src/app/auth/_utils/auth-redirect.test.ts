import { describe, expect, it } from "vitest";
import {
  getCallbackHref,
  getLoginHref,
  getOtpHref,
  getSetupHref,
  readRedirectTo,
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

describe("auth hrefs", () => {
  it("carry the app's address forward, encoded", () => {
    const encoded = encodeURIComponent(APP_CALLBACK);

    expect(getCallbackHref(APP_CALLBACK)).toBe(`/auth/callback?redirectTo=${encoded}`);
    expect(getLoginHref(APP_CALLBACK)).toBe(`/auth/login?redirectTo=${encoded}`);
    expect(getSetupHref(APP_CALLBACK)).toBe(`/auth/setup?redirectTo=${encoded}`);

    expect(getOtpHref({ email: "ana@zoonk.test", redirectTo: APP_CALLBACK })).toBe(
      `/auth/otp?email=ana%40zoonk.test&redirectTo=${encoded}`,
    );
  });

  it("leave the address out when sign-in started on the API", () => {
    expect(getCallbackHref(null)).toBe("/auth/callback");
    expect(getLoginHref(null)).toBe("/auth/login");
    expect(getSetupHref(null)).toBe("/auth/setup");

    expect(getOtpHref({ email: "ana@zoonk.test", redirectTo: null })).toBe(
      "/auth/otp?email=ana%40zoonk.test",
    );
  });
});
