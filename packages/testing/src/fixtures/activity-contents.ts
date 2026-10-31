import { computingLanguagesActivities } from "./activity-contents/computing-languages";
import { geometryProbabilityActivities } from "./activity-contents/geometry-probability";
import { musicAnySubjectActivities } from "./activity-contents/music-any-subject";
import { numbersAlgebraActivities } from "./activity-contents/numbers-algebra";
import { scienceMoneyActivities } from "./activity-contents/science-money";
import { societyReasoningActivities } from "./activity-contents/society-reasoning";

/** In catalog order, so a preview lists the templates the way the catalog groups them. */
export const activityFixtureAreas: readonly {
  fixtures: Readonly<Record<string, Record<string, unknown> & { template: string }>>;
  title: string;
}[] = [
  { fixtures: numbersAlgebraActivities, title: "Numbers and algebra" },
  { fixtures: geometryProbabilityActivities, title: "Geometry and probability" },
  { fixtures: scienceMoneyActivities, title: "Science and money" },
  { fixtures: computingLanguagesActivities, title: "Computing and languages" },
  { fixtures: societyReasoningActivities, title: "Society and reasoning" },
  { fixtures: musicAnySubjectActivities, title: "Music and any subject" },
];

/** Plain JSON: parse it with core's `activityContentSchema` for typed fields. */
export const activityContentFixtures = {
  ...numbersAlgebraActivities,
  ...geometryProbabilityActivities,
  ...scienceMoneyActivities,
  ...computingLanguagesActivities,
  ...societyReasoningActivities,
  ...musicAnySubjectActivities,
};

export { engineModeFixtures } from "./activity-contents/engine-modes";
