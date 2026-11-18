import { describe, expect, it } from "vitest";
import { getCertificateExample } from "./certificate-example";

describe(getCertificateExample, () => {
  it("shows a Spanish certificate for Spanish language variants", () => {
    expect(getCertificateExample({ language: "es-MX" })).toBe("DELE");
  });

  it("shows the exam for the learner's Portuguese variety", () => {
    expect(getCertificateExample({ language: "pt", region: "BR" })).toBe("Celpe-Bras");
    expect(getCertificateExample({ language: "pt", region: "PT" })).toBe("CAPLE");
  });

  it("offers a language exam without assuming a country", () => {
    expect(getCertificateExample({ language: "pt", region: "AO" })).toBe("ACTFL OPI");
    expect(getCertificateExample({ language: "pt", region: null })).toBe("ACTFL OPI");
  });

  it("leaves the example out when the language has no entry", () => {
    expect(getCertificateExample({ language: "eo" })).toBeUndefined();
    expect(getCertificateExample({ language: null })).toBeUndefined();
  });
});
