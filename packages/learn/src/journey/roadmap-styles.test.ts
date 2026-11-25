import { describe, expect, it } from "vitest";
import { chooseBandFit, splitBandName } from "./roadmap-styles";

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

    expect(splitBandName("Funções do primeiro grau")).toStrictEqual([
      "Funções",
      "do primeiro grau",
    ]);

    expect(splitBandName("Como funcionam as negociações")).toStrictEqual([
      "Como funcionam",
      "as negociações",
    ]);
  });

  it("takes the cut that reads badly in fewer ways when every cut reads badly", () => {
    expect(splitBandName("Art and architecture")).toStrictEqual(["Art", "and architecture"]);
  });

  it("takes the balanced cut when every cut leaves one word alone", () => {
    expect(splitBandName("Investimentos internacionais")).toStrictEqual([
      "Investimentos",
      "internacionais",
    ]);
  });
});

describe(chooseBandFit, () => {
  it("keeps each name's parts whole when every band fits them", () => {
    expect(chooseBandFit(() => false)).toBe("parts");
  });

  it("breaks the names between words when the parts don't fit", () => {
    expect(chooseBandFit((fit) => fit === "parts")).toBe("words");
  });

  it("breaks inside words when no way fits, and tries no further than the first that does", () => {
    const tried: string[] = [];

    expect(chooseBandFit((fit) => fit !== "letters")).toBe("letters");
    expect(chooseBandFit(() => true)).toBe("letters");

    chooseBandFit((fit) => {
      tried.push(fit);
      return false;
    });

    expect(tried).toStrictEqual(["parts"]);
  });
});
