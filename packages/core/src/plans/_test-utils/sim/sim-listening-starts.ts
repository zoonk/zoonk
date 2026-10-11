import { type CourseLevel } from "@zoonk/db";
import {
  getPlacementConfirmedBand,
  pickPlacementListeningAreas,
} from "../../_utils/level-listening-starts";
import { type SimWorld } from "./sim-world";

/**
 * The pure tier's copy of `listPlacementListeningAreas`: the exam's listening areas placement's
 * text answers (`known`, those it took as known) start past the basics of the band they confirm,
 * leaving out areas already past them. The plan's skills are the graph's, their bands the
 * Library's, the misses the learner's test answers (the pure tier has no others), and the areas
 * whose start the learner chose those of their applied `setAreaStart` changes. The conformance
 * test fails when this copy drifts.
 */
export function listSimPlacementListeningAreas({
  known,
  world,
}: {
  known: readonly string[];
  world: SimWorld;
}): string[] {
  const { inputs, learner, plan } = world;
  const listening = inputs.listeningSkillIds;

  if (known.length === 0 || listening.size === 0) {
    return [];
  }

  const { library } = inputs;
  const { graph, settings } = plan.state;

  const bands = new Map<string, CourseLevel | null>(
    library.fixture.skills.map(([shortId, level]) => [library.toId(shortId), level]),
  );

  const confirmedBand = getPlacementConfirmedBand({
    knownSkillIds: new Set(known),
    missedSkillIds: new Set(
      learner.testAnswers.flatMap((answer) =>
        "isCorrect" in answer && !answer.isCorrect ? [answer.skillId] : [],
      ),
    ),
    skills: graph.skills
      .filter((skill) => !listening.has(skill.skillId))
      .map((skill) => ({ band: bands.get(skill.skillId) ?? null, id: skill.skillId })),
  });

  const chosen = new Set(
    world.changes.flatMap((change) =>
      change.status === "applied"
        ? change.operations.flatMap((operation) =>
            operation.kind === "setAreaStart" ? operation.areas : [],
          )
        : [],
    ),
  );

  return pickPlacementListeningAreas({
    bands,
    chosen,
    confirmedBand,
    graph,
    listening,
    prerequisites: inputs.prerequisites,
  }).filter((area) => !settings.pastBasicsAreas.includes(area));
}
