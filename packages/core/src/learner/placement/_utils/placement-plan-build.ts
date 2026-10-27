import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { toListeningExam } from "../../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../../exams/listening/listening-skills";
import { awaitsExamBlueprint } from "../../../library/exams/notice-formats";
import { loadSkillPrerequisites } from "../../../library/skills/skill-prerequisites";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { pickPlacementItemSkillIds } from "../placement-item-picks";
import { type OwnLevel } from "../placement-steps";

/**
 * A plan whose run never recorded the end of placement's questions (a lost run, or a plan built
 * before the run recorded it) stops waiting for them this long after its graph was written.
 */
const QUESTION_WRITING_WINDOW_MS = 10 * 60 * 1000;

/** How the run building the goal's plan went, as placement needs it. */
type PlanBuild = {
  /** The run gave up before the plan had skills: nothing will come until it's started again. */
  failed: boolean;
  /** The skills whose placement questions are still being written: none once writing ended. */
  preparingSkillIds: Set<string>;
  /**
   * A language certificate's questions are being written before its blueprint is linked
   * (`awaitsExamBlueprint`): placement asks nothing yet, since a skill only recordings practice
   * isn't known as one, and would get a text question.
   */
  waitsForExam: boolean;
};

/** How the run building the goal's plan went, and which placement questions it still writes. */
export async function loadPlanBuild({
  everySkill,
  focusAreas,
  goalId,
  knownAreas,
  ownLevel,
  tx = prisma,
}: {
  /** A test from the learner's own material, whose every skill gets questions. */
  everySkill: boolean;
  /** The plan's areas the learner said are weak, whose picks come first. */
  focusAreas: readonly string[];
  goalId: string;
  /** The subjects the learner knows well, whose basics placement writes no questions for. */
  knownAreas: readonly string[];
  /** The learner's own level, where placement starts asking in each subject. */
  ownLevel: OwnLevel | null;
  tx?: TransactionClient;
}): Promise<PlanBuild> {
  const plan = await tx.plan.findUnique({
    select: {
      buildFailedAt: true,
      createdAt: true,
      generatedAt: true,
      goal: {
        select: { examBlueprint: true, examBlueprintId: true, kind: true, targetLanguage: true },
      },
      graph: true,
      placementPreparedAt: true,
    },
    where: { goalId },
  });

  if (!plan) {
    return { failed: false, preparingSkillIds: new Set(), waitsForExam: false };
  }

  const graphWrittenAt = plan.generatedAt ?? plan.createdAt;

  const writing =
    plan.placementPreparedAt === null &&
    Date.now() - graphWrittenAt.getTime() < QUESTION_WRITING_WINDOW_MS;

  const graph = parsePlanGraph(plan.graph);

  return {
    failed: plan.buildFailedAt !== null,
    preparingSkillIds: new Set(
      writing
        ? pickPlacementItemSkillIds({
            everySkill,
            focusAreas,
            graph,
            knownAreas,
            listeningSkillIds: getListeningSkillIds({ exam: toListeningExam(plan.goal), graph }),
            ownLevel,
            prerequisites: await loadSkillPrerequisites(
              graph.skills.map((skill) => skill.skillId),
              tx,
            ),
          })
        : [],
    ),
    waitsForExam: writing && awaitsExamBlueprint(plan.goal),
  };
}
