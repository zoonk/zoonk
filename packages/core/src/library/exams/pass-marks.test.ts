import { describe, expect, it } from "vitest";
import { type ExamStructure } from "./blueprint-contract";
import { getPassMarks, listPassMarkTexts, withPassMarkTranslations } from "./pass-marks";

const citation = { passage: "", sourceId: "notice" };

const GROUPS = "Apto con un mínimo de 30 puntos en el Grupo 1 y 30 puntos en el Grupo 2.";
const TOTAL = "Apto con 60 puntos de 100.";

const blueprint = { language: "es" };

function structure(rules: ExamStructure["rules"]): ExamStructure {
  return { formats: [], mock: null, rules, subjects: [] };
}

describe(getPassMarks, () => {
  it("says the pass marks in the learner's language when the reading translated them", () => {
    const rules = structure([
      { citation, kind: "passMark", text: GROUPS, translations: { pt: "Grupos: 30 e 30." } },
      { citation, kind: "other", text: "Sin penalización." },
      { citation, kind: "passMark", text: TOTAL, translations: { pt: "60 de 100." } },
    ]);

    expect(
      getPassMarks({ blueprint, goal: { language: "pt-BR" }, structure: rules }),
    ).toStrictEqual({ language: "pt", texts: ["Grupos: 30 e 30.", "60 de 100."] });
  });

  it("keeps the notice's words, in its language, unless every pass mark is in the learner's", () => {
    const rules = structure([
      { citation, kind: "passMark", text: GROUPS, translations: { pt: "Grupos: 30 e 30." } },
      { citation, kind: "passMark", text: TOTAL },
    ]);

    const notice = { language: "es", texts: [GROUPS, TOTAL] };

    expect(getPassMarks({ blueprint, goal: { language: "pt" }, structure: rules })).toStrictEqual(
      notice,
    );

    expect(getPassMarks({ blueprint, goal: null, structure: rules })).toStrictEqual(notice);

    expect(getPassMarks({ blueprint, goal: { language: "es" }, structure: rules })).toStrictEqual(
      notice,
    );
  });

  it("is null for an exam without a pass mark", () => {
    const rules = structure([{ citation, kind: "other", text: "Sin penalización." }]);
    expect(getPassMarks({ blueprint, goal: { language: "pt" }, structure: rules })).toBeNull();
  });
});

describe(withPassMarkTranslations, () => {
  it("gives each pass mark the checks kept its translations, by its text", () => {
    const read = [
      { kind: "passMark" as const, text: GROUPS },
      { kind: "other" as const, text: "Sin penalización." },
      { kind: "passMark" as const, text: TOTAL },
    ];

    const texts = listPassMarkTexts(read);

    const kept = structure([
      { citation, kind: "other", text: "Sin penalización." },
      { citation, kind: "passMark", text: TOTAL },
    ]);

    const translated = withPassMarkTranslations({
      structure: kept,
      texts,
      translations: {
        en: ["Pass: 30 and 30.", "60 of 100."],
        pt: ["Grupos: 30 e 30.", "60 de 100."],
      },
    });

    expect(texts).toStrictEqual([GROUPS, TOTAL]);

    expect(translated.rules).toStrictEqual([
      { citation, kind: "other", text: "Sin penalización." },
      {
        citation,
        kind: "passMark",
        text: TOTAL,
        translations: { en: "60 of 100.", pt: "60 de 100." },
      },
    ]);
  });

  it("leaves the structure as it is when nothing was translated", () => {
    const kept = structure([{ citation, kind: "passMark", text: TOTAL }]);

    expect(withPassMarkTranslations({ structure: kept, texts: [TOTAL], translations: {} })).toBe(
      kept,
    );
  });
});
