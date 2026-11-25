import { describe, expect, it } from "vitest";
import { fitBandSizes, splitBandName } from "./roadmap-styles";

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

describe(fitBandSizes, () => {
  it("keeps every name's parts when the bands fit them", () => {
    expect(fitBandSizes({ available: 300, parts: [100, 120], words: [80, 90] })).toStrictEqual([
      { fit: "parts", width: null },
      { fit: "parts", width: null },
    ]);
  });

  it("breaks only the widest names between words, at the widest width that fits the row", () => {
    expect(
      fitBandSizes({ available: 400, parts: [80, 110, 150, 140], words: [72, 90, 80, 136] }),
    ).toStrictEqual([
      { fit: "parts", width: 80 },
      { fit: "words", width: 92 },
      { fit: "words", width: 92 },
      { fit: "words", width: 136 },
    ]);
  });

  it("never holds a band under its longest word", () => {
    expect(fitBandSizes({ available: 250, parts: [150, 150], words: [130, 72] })).toStrictEqual([
      { fit: "words", width: 130 },
      { fit: "words", width: 120 },
    ]);
  });

  it("breaks inside words when not even the longest words fit", () => {
    expect(fitBandSizes({ available: 100, parts: [90, 90], words: [72, 72] })).toStrictEqual([
      { fit: "letters", width: null },
      { fit: "letters", width: null },
    ]);
  });
});
