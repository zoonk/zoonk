import "server-only";
import { chooseBases } from "../planner/base-choices";
import { type BuildPlanInput } from "../planner/build-plan";
import { type ExamSubjectShare } from "../planner/feasibility-coverage";
import { getPlanFeasibility } from "../planner/plan-feasibility";
import { readBuiltPlan } from "./read-built-plan";

/** Which read asks: the screens or the API's full plan. Both read the same analysis now. */
export type PlanAnalysisPurpose = "screen" | "full";

/**
 * What the plan covers at the learner's own time, read from its own build and the one its graph
 * sizes, and whether their time covers everything once planned again (`timeCovers`, one more build
 * only when the sized plan is whole): explicit fields, so serializing it never runs the searches of
 * other daily times or dates, which the learner asks for (see `findPlanTimeToCover`). Keyed by its
 * complete input and owner, so a write that changes nothing it reads leaves it cached.
 */
export async function readPlanAnalysis({
  examSubjects,
  input,
  landing,
  userId,
}: {
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  landing: Pick<BuildPlanInput, "heldSkillsLand" | "landedOnly">;
  userId: string;
}) {
  "use cache";

  const planned = await readBuiltPlan({ input: { ...input, ...landing }, userId });
  const feasibility = getPlanFeasibility({ examSubjects, input, planned });

  return {
    // The bases as the learner chooses for them; what the app recommends plans every base in depth,
    // so the learner asks for it (see `getPlanBasesAdvice`).
    bases: chooseBases(input).input.bases ?? [],
    feasibility: {
      coreFits: feasibility.coreFits,
      coveredShare: feasibility.coveredShare,
      deadline: feasibility.deadline,
      deepensMostAsked: feasibility.deepensMostAsked,
      endDate: feasibility.endDate,
      fits: feasibility.fits,
      measure: feasibility.measure,
      skillFits: feasibility.skillFits,
      timeCovers: feasibility.timeCovers,
    },
  };
}
