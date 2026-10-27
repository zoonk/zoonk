import { withPastBasicsAreas } from "../../_utils/level-listening-starts";
import { type RuleAnswer, type RuleEvent } from "../rules/rule-context";
import { getPlacementAnswerTime } from "./sim-claims";
import { toRuleFormat, toSimItemFormat } from "./sim-items";
import { type SimLifeStep } from "./sim-life-plan";
import { listSimPlacementListeningAreas } from "./sim-listening-starts";
import { commitSimPlan, computeSimPlan } from "./sim-planner";
import { type Runner, record, skillAt } from "./sim-runner";
import { place } from "./sim-session";
import { type SimPlan, atNoon } from "./sim-world";

/**
 * The pure tier's placement: the copy of what placement's end does with its answers
 * (`finishGoalPlacement`): the skills they show known tested out and announced
 * (`announceTestedOutItems`), or the plan planned again when they skipped nothing
 * (`replanAfterPlacement`), with the listening areas they start past the basics of.
 */

/**
 * `replanAfterPlacement`'s copy: answers that skipped nothing plan again from today when they
 * changed what the plan is planned from (what the learner missed or showed they know, the listening
 * areas they start past the basics of).
 */
function replanAfterPlacement(
  runner: Runner,
  {
    before,
    event,
    pastBasicsAreas,
    step,
  }: {
    before: SimPlan;
    event: Extract<RuleEvent, { kind: "placement" }>;
    pastBasicsAreas: readonly string[];
    step: number;
  },
) {
  const { world } = runner;
  const { state } = world.plan;

  const computed = computeSimPlan({
    mode: "forced",
    state: withPastBasicsAreas({ areas: pastBasicsAreas, state }),
    world,
  });

  if (computed.inputsKey === world.plan.inputsKey) {
    record(runner, { before, change: null, event, label: "placement", plan: before, step });
    return;
  }

  record(runner, {
    before,
    change: null,
    event,
    label: "placement",
    plan: commitSimPlan({ computed, world }),
    step,
  });
}

export function runPlacement(
  runner: Runner,
  step: Extract<SimLifeStep, { kind: "placement" }>,
  index: number,
) {
  const { world } = runner;

  // Placement never asks a skill the exam practices only with its recordings.
  const given = step.answers
    .map(([skill, correct]) => [skillAt(runner, skill), correct] as const)
    .filter(([skillId]) => !runner.inputs.listeningSkillIds.has(skillId));

  const format = toSimItemFormat(runner.inputs.choice);
  const { known } = place({ answers: given, format, world });
  const knownSet = new Set(known);
  const before = world.plan;

  const answers = given.map(([skillId, correct]): RuleAnswer => ({
    at: world.today,
    correct,
    format: toRuleFormat(format),
    skillId,
    source: "placement",
  }));

  runner.answers.push(...answers);

  const items = world.plan.items.map((item) =>
    item.status === "todo" && item.kind === "lesson" && item.skillId && knownSet.has(item.skillId)
      ? { ...item, completedAt: atNoon(world.today), status: "testedOut" as const }
      : item,
  );

  runner.world = {
    ...world,
    learner: {
      ...world.learner,
      testAnswers: [
        ...world.learner.testAnswers,
        ...answers.map((answer, position) => ({
          at: getPlacementAnswerTime({
            at: atNoon(world.today),
            count: answers.length,
            index: position,
          }),
          isCorrect: answer.correct,
          kind: "test" as const,
          skillId: answer.skillId,
          trueFalse: format === "trueFalse",
        })),
      ],
    },
    plan: { ...world.plan, items },
  };

  const event = { kind: "placement" as const };
  const pastBasicsAreas = listSimPlacementListeningAreas({ known, world: runner.world });

  // `announceTestedOutItems` re-plans and says so when placement skipped something.
  if (items.every((item, position) => item === world.plan.items[position])) {
    replanAfterPlacement(runner, { before, event, pastBasicsAreas, step: index });
    return;
  }

  const { state } = runner.world.plan;

  const computed = computeSimPlan({
    mode: "forced",
    state: withPastBasicsAreas({ areas: pastBasicsAreas, state }),
    world: runner.world,
  });

  record(runner, {
    before,
    change: null,
    event,
    label: "placement",
    plan: commitSimPlan({ computed, world: runner.world }),
    step: index,
  });
}
