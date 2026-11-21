import { CEFR_LEVELS, parseCefrScore } from "@zoonk/utils/cefr";
import { type LevelTestLength } from "../level-test-contract";

export function getLevelTestStartScore({
  length,
  level,
}: {
  length?: LevelTestLength;
  level: unknown;
}): number {
  switch (level) {
    case "none":
      return CEFR_LEVELS.indexOf("A1");
    case "intermediate":
      return CEFR_LEVELS.indexOf("B1");
    case "advanced":
      return CEFR_LEVELS.indexOf(length === "wholeCourse" ? "C1" : "B2");
    default:
      return parseCefrScore(level) ?? CEFR_LEVELS.indexOf("A2");
  }
}
