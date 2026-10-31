import { describe, expect, it } from "vitest";
import { getUsageDataChoice, parseUsageDataCookie, resolveUsageDataSharing } from "./usage-data";

describe(resolveUsageDataSharing, () => {
  it("asks first in the EU, EEA, UK, Switzerland and Turkey", () => {
    for (const country of ["DE", "fr", "NO", "IS", "LI", "GB", "CH", "TR"]) {
      expect(resolveUsageDataSharing({ choice: null, country })).toBeNull();
    }
  });

  it("shares without asking elsewhere", () => {
    for (const country of ["US", "BR", "KR", "JP", "RU"]) {
      expect(resolveUsageDataSharing({ choice: null, country })).toBe(true);
    }
  });

  it("asks when the country is unknown", () => {
    expect(resolveUsageDataSharing({ choice: null, country: null })).toBeNull();
  });

  it("keeps a choice anywhere", () => {
    expect(resolveUsageDataSharing({ choice: false, country: "US" })).toBe(false);
    expect(resolveUsageDataSharing({ choice: true, country: "DE" })).toBe(true);
  });

  it("waits for a choice where the law needs a yes, and shares elsewhere", () => {
    expect(resolveUsageDataSharing({ choice: null, country: "DE" })).toBeNull();
    expect(resolveUsageDataSharing({ choice: null, country: "BR" })).toBe(true);
  });
});

describe(parseUsageDataCookie, () => {
  it("reads only the two values it writes", () => {
    expect(parseUsageDataCookie("on")).toBe(true);
    expect(parseUsageDataCookie("off")).toBe(false);
    expect(parseUsageDataCookie("yes")).toBeNull();
    expect(parseUsageDataCookie(null)).toBeNull();
  });
});

describe(getUsageDataChoice, () => {
  it("lets a no from the account or the browser win", () => {
    expect(getUsageDataChoice({ account: false, browser: true })).toBe(false);
    expect(getUsageDataChoice({ account: true, browser: false })).toBe(false);
  });

  it("takes whichever choice there is", () => {
    expect(getUsageDataChoice({ account: true, browser: null })).toBe(true);
    expect(getUsageDataChoice({ account: null, browser: true })).toBe(true);
    expect(getUsageDataChoice({ account: null, browser: null })).toBeNull();
  });
});
