import { type CefrLevel } from "@zoonk/utils/cefr";
import { languagePlanningBand } from "../../levels/skill-level-rules";
import { getBand, getLevelTestAssessment } from "../level-test-rules";
import { getMean } from "./level-test-posterior";

const HALF_STEP = 0.5;

export function getLevelTestPlanningStart(
  input: Parameters<typeof getLevelTestAssessment>[0],
  stated: number,
  skipped: CefrLevel | undefined,
) {
  const assessment = getLevelTestAssessment(input);

  if (assessment.some(({ complete }) => !complete)) {
    return null;
  }

  const mean = Math.min(
    ...assessment.map(({ posterior, unknownStreak }) => (unknownStreak ? 0 : getMean(posterior))),
  );

  return Math.max(
    languagePlanningBand(mean),
    Math.min(languagePlanningBand(stated), languagePlanningBand(mean + HALF_STEP)),
    skipped ? languagePlanningBand(getBand(skipped) + 1) : 0,
  );
}
