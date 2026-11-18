import { describe, expect, it } from "vitest";
import { getCertificateExample } from "./certificate-example";

describe(getCertificateExample, () => {
  it("shows a Spanish certificate for Spanish language variants", () => {
    expect(getCertificateExample("es-MX")).toBe("DELE");
  });

  it("leaves the example out when the language has no entry", () => {
    expect(getCertificateExample("eo")).toBeUndefined();
    expect(getCertificateExample(null)).toBeUndefined();
  });
});
