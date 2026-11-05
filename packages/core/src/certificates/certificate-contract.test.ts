import { describe, expect, it } from "vitest";
import { normalizeCertificateCode } from "./certificate-contract";

describe(normalizeCertificateCode, () => {
  it("reads a code as people type it from paper", () => {
    expect(normalizeCertificateCode("K7QF-2M9X-HD4P")).toBe("K7QF2M9XHD4P");
    expect(normalizeCertificateCode(" k7qf 2m9x hd4p ")).toBe("K7QF2M9XHD4P");
    expect(normalizeCertificateCode("IL0O-2M9X-HD4P")).toBe("11002M9XHD4P");
  });

  it("refuses what no code can be", () => {
    expect(normalizeCertificateCode("K7QF-2M9X-HD4")).toBeNull();
    expect(normalizeCertificateCode("K7QF-2M9X-HD4PQ")).toBeNull();
    expect(normalizeCertificateCode("U7QF-2M9X-HD4P")).toBeNull();
    expect(normalizeCertificateCode("K7QF/2M9X/HD4P")).toBeNull();
  });
});
