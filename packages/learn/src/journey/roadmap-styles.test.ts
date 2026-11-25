import { describe, expect, it } from "vitest";
import { splitBandName } from "./roadmap-styles";

describe(splitBandName, () => {
  it("keeps a short name or a single word on one line", () => {
    expect(splitBandName("Python basics")).toStrictEqual(["Python basics", null]);
    expect(splitBandName("Supercalifragilistic")).toStrictEqual(["Supercalifragilistic", null]);
  });

  it("cuts a longer name where its longer line is shortest", () => {
    expect(splitBandName("Ordering food at a restaurant")).toStrictEqual([
      "Ordering food",
      "at a restaurant",
    ]);
  });

  it("never ends the first line on a short word or leaves one word alone when another cut exists", () => {
    expect(splitBandName("Médico e farmácia")).toStrictEqual(["Médico", "e farmácia"]);

    expect(splitBandName("Como funcionam as negociações")).toStrictEqual([
      "Como funcionam",
      "as negociações",
    ]);
  });

  it("takes the balanced cut when every cut leaves one word alone", () => {
    expect(splitBandName("Investimentos internacionais")).toStrictEqual([
      "Investimentos",
      "internacionais",
    ]);
  });
});
