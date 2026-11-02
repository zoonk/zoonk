import { describe, expect, it } from "vitest";
import { foldChangeAreas } from "./fold-part-areas";

const LANGUAGES = "Linguagens";
const ENGLISH = "Língua Inglesa";
const MATH = "Matemática";
const partAreas = new Map([[ENGLISH, LANGUAGES]]);

const effect = { endDateAfter: null, endDateBefore: null, lessonsAdded: 0, lessonsRemoved: 0 };

describe(foldChangeAreas, () => {
  it("names the language Ana takes by the languages area it's part of, merged with it", () => {
    const change = foldChangeAreas({
      change: {
        effect: {
          ...effect,
          areaEnds: [
            { after: "2026-11-01", area: LANGUAGES, before: "2026-12-01" },
            { after: "2026-11-08", area: ENGLISH, before: "2026-11-20" },
          ],
          areaLessons: [
            { after: 20, area: LANGUAGES, before: 30 },
            { after: 4, area: ENGLISH, before: 6 },
            { after: 10, area: MATH, before: 12 },
          ],
          areaStarts: [
            { after: "2026-10-12", area: LANGUAGES, before: "2026-10-20" },
            { after: "2026-10-10", area: ENGLISH, before: null },
          ],
          reviewFirst: { areas: [LANGUAGES, ENGLISH], date: "2026-10-11" },
          topicsLeftOut: [
            { area: LANGUAGES, topics: ["Gêneros digitais"] },
            { area: ENGLISH, topics: ["Vocábulos em inglês"] },
          ],
        },
        operations: [{ areas: [LANGUAGES, ENGLISH], kind: "focusAreas" }],
      },
      partAreas,
    });

    expect(change).toStrictEqual({
      effect: {
        ...effect,
        areaEnds: [{ after: "2026-11-08", area: LANGUAGES, before: "2026-12-01" }],
        areaLessons: [
          { after: 24, area: LANGUAGES, before: 36 },
          { after: 10, area: MATH, before: 12 },
        ],
        areaStarts: [{ after: "2026-10-10", area: LANGUAGES, before: "2026-10-20" }],
        reviewFirst: { areas: [LANGUAGES], date: "2026-10-11" },
        topicsLeftOut: [{ area: LANGUAGES, topics: ["Gêneros digitais", "Vocábulos em inglês"] }],
      },
      operations: [{ areas: [LANGUAGES], kind: "focusAreas" }],
    });
  });

  it("keeps a part's own name when its area isn't named beside it", () => {
    const change = {
      effect: { ...effect, areaLessons: [{ after: 4, area: ENGLISH, before: 6 }] },
      operations: [{ areas: [ENGLISH], kind: "skipAreas" as const }],
    };

    expect(foldChangeAreas({ change, partAreas })).toStrictEqual(change);
  });
});
