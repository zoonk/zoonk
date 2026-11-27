import { CEFR_LEVELS, parseCefrScore } from "@zoonk/utils/cefr";

/** The first question can meet a learner at their stated level without treating it as evidence. */
export function getLevelTestStart(level: unknown): { firstBand?: number; start: number } {
  switch (level) {
    case "none":
      return { start: CEFR_LEVELS.indexOf("A1") };
    case "basic":
      return { start: CEFR_LEVELS.indexOf("A2") };
    case "intermediate":
      return { start: CEFR_LEVELS.indexOf("B1") };
    case "advanced":
      return { firstBand: CEFR_LEVELS.indexOf("C1"), start: CEFR_LEVELS.indexOf("B2") };
    default: {
      const score = parseCefrScore(level);

      return score === null
        ? { firstBand: CEFR_LEVELS.indexOf("A1"), start: CEFR_LEVELS.indexOf("A2") }
        : { start: score };
    }
  }
}
