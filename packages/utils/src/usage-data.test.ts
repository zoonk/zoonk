import { describe, expect, it } from "vitest";
import { getUsageDataChoice, parseUsageDataCookie, resolveUsageDataSharing } from "./usage-data";

function sharing({ choice = null, country }: { choice?: boolean | null; country: string | null }) {
  return resolveUsageDataSharing({ choice, country });
}

describe(resolveUsageDataSharing, () => {
  it("asks first in the EU, EEA, UK, Switzerland and Turkey", () => {
    for (const country of ["DE", "fr", "NO", "IS", "LI", "GB", "CH", "TR"]) {
      expect(sharing({ country })).toBeNull();
    }
  });

  it("asks first in their territories that have a code of their own", () => {
    const territories = ["RE", "GP", "MQ", "GF", "YT", "MF", "BL", "PM", "NC", "PF", "WF", "TF"];

    for (const country of [...territories, "AX", "SJ", "BV", "GI", "JE", "GG", "IM"]) {
      expect(sharing({ country })).toBeNull();
    }
  });

  it("shares without asking elsewhere, including territories outside those laws", () => {
    for (const country of ["US", "BR", "KR", "JP", "RU", "GL", "FO", "AW", "CW", "BQ", "BM"]) {
      expect(sharing({ country })).toBe(true);
    }
  });

  it("asks when the country is unknown", () => {
    expect(sharing({ country: null })).toBeNull();
  });

  it("keeps a choice anywhere", () => {
    expect(sharing({ choice: false, country: "US" })).toBe(false);
    expect(sharing({ choice: true, country: "DE" })).toBe(true);
  });
});

describe(parseUsageDataCookie, () => {
  it("reads only the two choices it writes", () => {
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
