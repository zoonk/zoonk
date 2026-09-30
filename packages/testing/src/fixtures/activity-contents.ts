import { computingLanguagesActivities } from "./activity-contents/computing-languages";
import { geometryProbabilityActivities } from "./activity-contents/geometry-probability";
import { musicAnySubjectActivities } from "./activity-contents/music-any-subject";
import { numbersAlgebraActivities } from "./activity-contents/numbers-algebra";
import { scienceMoneyActivities } from "./activity-contents/science-money";
import { societyReasoningActivities } from "./activity-contents/society-reasoning";

/**
 * One valid `activity` step content per template, keyed by template id. Core's validator test
 * proves each one publishes, so E2E lessons can reuse them as they are.
 * The data is plain JSON; parse it with core's `activityContentSchema` for typed fields.
 */
export const activityContentFixtures = {
  ...numbersAlgebraActivities,
  ...geometryProbabilityActivities,
  ...scienceMoneyActivities,
  ...computingLanguagesActivities,
  ...societyReasoningActivities,
  ...musicAnySubjectActivities,
};
