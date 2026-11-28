import { type CefrLevel } from "@zoonk/utils/cefr";
import { languagePlanningBand } from "../../aims/language-aims";
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

  const statedLevel = Math.floor(stated);

  const corroborated = assessment.every(
    ({ scored }) =>
      scored.some(({ band, correct }) => band >= statedLevel && correct === true) &&
      scored.every(({ band, correct }) => band > statedLevel || correct === true),
  );

  // The posterior estimates the level being studied. A supported statement names a level reached.
  const reached = Math.max(0, mean - 1);
  const claimed = corroborated ? stated : Math.min(stated - 1, reached + HALF_STEP);

  return languagePlanningBand(Math.max(reached, claimed, skipped ? getBand(skipped) : 0));
}
