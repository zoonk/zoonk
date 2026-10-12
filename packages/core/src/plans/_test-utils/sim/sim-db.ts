import { isDeepStrictEqual } from "node:util";
import { prisma } from "@zoonk/db";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { loadPlacementPlan } from "../../../learner/_utils/goal-skill-graph";
import { proposeChange } from "../../_utils/apply-plan-change";
import { listPlacementListeningAreas } from "../../_utils/load-listening-starts";
import { loadPlanContext } from "../../_utils/plan-context";
import { settleNewPlan } from "../../_utils/recommended-bases";
import { computePlan } from "../../_utils/replan";
import { announceTestedOutItems } from "../../announce-tested-out-items";
import { changeGoalPlan } from "../../change-goal-plan";
import { createGoalPlan } from "../../create-goal-plan";
import { decidePlanChange } from "../../decide-plan-change";
import { type PlanOperation, planChangeInputSchema } from "../../plan-contract";
import { type PlanChangeView } from "../../plan-view-contract";
import { addDays, toIsoDate } from "../../planner/plan-calendar";
import { refreshGoalPlan } from "../../refresh-goal-plan";
import { replanAfterPlacement } from "../../replan-after-placement";
import { RULES_READING, checkRules } from "../rules/check-rules";
import { type RuleAnswer } from "../rules/rule-context";
import { toRulePlan } from "./sim-context";
import { toRuleFormat, toSimItemFormat } from "./sim-db-items";
import { loadCopyExam, recordPlacementAnswers } from "./sim-db-questions";
import { deleteSimLearner, readSimPlan, setSimToday } from "./sim-db-reads";
import { type DbRunner, recordDb, skillAtDb, startDbRunner } from "./sim-db-runner";
import { runStudyDb } from "./sim-db-study";
import { landDb, listWaitingDb, openTodayDb } from "./sim-db-today";
import { undoDb } from "./sim-db-undo";
import { type SimLife, type SimLifeStep } from "./sim-life-plan";
import { toOperations } from "./sim-operations";
import { type SimCheck, type SimResult } from "./sim-runner";
import { place } from "./sim-session";

/**
 * The simulator's database tier: the same life through the real capabilities (`createGoalPlan`,
 * Today's session and its blocks, `changeGoalPlan`, the buddy's proposal and its answer, outlines
 * landing, placement's test-outs, account deletion) on a library copy of the life's own, with the
 * same rule checks after each step. No AI: lessons end as the player records them (a learning
 * event), or, with a question bank, are written without a model and played through the lesson
 * player (`sim-db-lessons.ts`). Test files using it mock `../users/get-session`, `next/headers`,
 * `../progress/get-request-date-context`, the mistake classifier and `@vercel/blob`, and fake
 * `Date`.
 */

async function runPlacement(
  runner: DbRunner,
  step: Extract<SimLifeStep, { kind: "placement" }>,
  index: number,
) {
  const plan = runner.last ?? (await readSimPlan(runner.goal.id));

  const listening = await loadListeningSkillIds(runner.goal.id);

  // Placement never asks a skill the exam practices only with its recordings.
  const given = step.answers
    .map(([skill, correct]) => [skillAtDb(runner, skill), correct] as const)
    .filter(([skillId]) => !listening.has(skillId));

  const { choice } = await loadCopyExam(runner.library);
  const format = toSimItemFormat(choice);
  const placed = place({ answers: given, format, world: { plan } });
  const known = new Set(placed.known);

  const answers = given.map(([skillId, correct]): RuleAnswer => ({
    at: runner.today,
    correct,
    format: toRuleFormat(format),
    skillId,
    source: "placement",
  }));

  runner.answers.push(...answers);
  placed.missed.forEach((skillId) => runner.missed.add(skillId));

  await recordPlacementAnswers({
    answers: given,
    at: new Date(),
    choice,
    language: runner.library.fixture.goal.language,
    memory: runner.questions,
    userId: runner.goal.userId,
  });

  // Placement's text answers start the exam's listening areas past the basics of the band they
  // confirm, with what they skipped (`applyPlacement`).
  const placementPlan = await loadPlacementPlan(runner.goal.id);

  const pastBasicsAreas = await listPlacementListeningAreas({
    goalId: runner.goal.id,
    knownSkillIds: placed.known,
    skills: placementPlan.skills,
    userId: runner.goal.userId,
  });

  const planItemIds = plan.items.flatMap((item) =>
    item.status === "todo" && item.kind === "lesson" && item.skillId && known.has(item.skillId)
      ? [item.id]
      : [],
  );

  await prisma.planItem.updateMany({
    data: { completedAt: new Date(), status: "testedOut" },
    where: { id: { in: planItemIds } },
  });

  await announceTestedOutItems({
    goalId: runner.goal.id,
    now: new Date(),
    pastBasicsAreas,
    planItemIds,
    timeZone: "UTC",
  });

  // Answers that skipped nothing still plan again when they change what the plan reads
  // (`finishGoalPlacement`).
  if (planItemIds.length === 0) {
    await replanAfterPlacement({
      goalId: runner.goal.id,
      now: new Date(),
      pastBasicsAreas,
      timeZone: "UTC",
    });
  }

  await recordDb(runner, {
    event: { answers, kind: "placement" },
    label: "placement",
    step: index,
  });

  if (step.undo && planItemIds.length > 0) {
    await undoDb(runner, { kind: "testedOut", restores: plan, step: index });
  }
}

/** The plan's bases, as the plan's screen reads them, for a change of how to study one. */
async function listBases(runner: DbRunner) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: runner.goal.id } });
  const context = await loadPlanContext({ goal });

  if (!context) {
    return [];
  }

  const computed = await computePlan({ context, mode: "forced" });
  return computed.bases.bases;
}

/**
 * The learner's changes without the edit a set-back undid (see `applyChange`): it's no longer one
 * they made, as an undo's isn't.
 */
function forgetLearnerChange(runner: DbRunner, change: PlanChangeView | null) {
  const index = runner.learnerChanges.findLastIndex((entry) =>
    isDeepStrictEqual(entry.operations, change?.operations),
  );

  if (change?.source !== "system" && index !== -1) {
    runner.learnerChanges.splice(index, 1);
  }
}

/**
 * The learner applies a change in the plan editor, or the buddy proposes it and they apply it:
 * false when no change was saved. In the editor, a change that sets back by hand what the latest
 * edit changed undoes that edit instead (`undoSetBack`), which answers with it, now undone, and a
 * choice of how to study bases that moves no lesson keeps only its settings, with no change.
 */
async function applyChange(
  runner: DbRunner,
  { operations, via }: { operations: PlanOperation[]; via: "buddy" | "editor" },
): Promise<boolean | "setBack"> {
  if (via === "editor") {
    const input = planChangeInputSchema.parse({ operations, timeZone: "UTC" });
    const result = await changeGoalPlan({ goalId: runner.goal.id, input });

    if (result.status === "applied" && result.change?.status === "undone") {
      forgetLearnerChange(runner, result.change);
      return "setBack";
    }

    return result.status === "applied" && result.change !== null;
  }

  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: runner.goal.id } });
  const context = await loadPlanContext({ goal });

  const proposed = context
    ? await proposeChange({
        approval: "always",
        context,
        operations,
        reason: "Sim buddy change.",
        source: "planEdit",
      })
    : null;

  if (proposed?.status !== "proposed") {
    return false;
  }

  const decided = await decidePlanChange({
    changeId: proposed.changeId,
    goalId: runner.goal.id,
    input: { status: "applied", timeZone: "UTC" },
  });

  return decided.status === "updated";
}

async function runChange(
  runner: DbRunner,
  step: Extract<SimLifeStep, { kind: "change" }>,
  index: number,
) {
  if (!runner.opened.has(toIsoDate(runner.today))) {
    await openTodayDb(runner, index);
  }

  const restores = runner.last ?? (await readSimPlan(runner.goal.id));
  const bases = step.spec.kind === "bases" ? await listBases(runner) : [];

  const operations = toOperations({
    areas: runner.areas,
    goalKind: runner.library.fixture.goal.kind,
    listBases: () => bases,
    spec: step.spec,
    state: restores.state,
    today: runner.today,
  });

  const applied = operations ? await applyChange(runner, { operations, via: step.via }) : false;

  // A change that wasn't saved (invalid, or a focus that moves nothing) leaves no step.
  if (!operations || !applied) {
    return;
  }

  await recordDb(runner, {
    event: { kind: "learnerChange", operations, ...(applied === "setBack" && { setBack: true }) },
    label: "change",
    step: index,
  });

  // A set-back was itself an Undo: it left nothing of its own to take back.
  if (step.undo && applied !== "setBack") {
    await undoDb(runner, { kind: "edited", restores, step: index });
  }
}

async function runLand(
  runner: DbRunner,
  step: Extract<SimLifeStep, { kind: "land" }>,
  index: number,
) {
  const landing = listWaitingDb(runner, null).slice(0, step.count);

  if (landing.length > 0) {
    await landDb(runner, { shortIds: landing, step: index });
  }
}

async function runStep(runner: DbRunner, step: SimLifeStep, index: number): Promise<void> {
  switch (step.kind) {
    case "placement":
      return runPlacement(runner, step, index);
    case "study":
      return runStudyDb(runner, step, index);
    case "miss":
      runner.today = addDays(runner.today, step.days);
      setSimToday(toIsoDate(runner.today));
      return;
    case "refresh":
      await openTodayDb(runner, index);
      await refreshGoalPlan({ goalId: runner.goal.id });
      await recordDb(runner, { event: { kind: "refresh" }, label: "refresh", step: index });
      return;
    case "land":
      return runLand(runner, step, index);
    case "change":
      return runChange(runner, step, index);
    default:
      return step satisfies never;
  }
}

/** Lives `life` through the real capabilities on a library copy of its own. */
export async function runSimLifeInDb(
  life: SimLife,
  {
    check = checkRules,
    deleteAccount = true,
    questions = false,
    rules,
    trace = false,
  }: {
    check?: SimCheck;
    deleteAccount?: boolean;
    /**
     * Gives the library a question bank, so sessions hold reviews, practice and duels the learner
     * answers (see `seedSimQuestions`). The pure tier has none, so lives compared with it leave
     * this off.
     */
    questions?: boolean;
    /**
     * The rules the test asserts: only their violations come back, and the life skips what only
     * other rules read (see `RULES_READING`). Planning the screens again after every step took
     * half of a life whose test asserts a rule on the plan itself. Every rule, when absent.
     */
    rules?: readonly string[];
    trace?: boolean;
  } = {},
): Promise<SimResult> {
  const reads = (what: keyof typeof RULES_READING) =>
    !rules || rules.some((rule) => RULES_READING[what].has(rule));

  const runner = await startDbRunner({
    check,
    life,
    questions,
    reads: { preparation: reads("preparation"), screens: reads("screens") },
    trace,
  });

  // The plan onboarding leaves: made, then settled by its last answer (`settleNewPlan`).
  await createGoalPlan({ goalId: runner.goal.id, graph: runner.library.graph, setup: "steps" });
  await settleNewPlan({ goalId: runner.goal.id });
  await recordDb(runner, { event: { kind: "planCreated" }, label: "create", step: -1 });

  // Each step reads the plan the one before left.
  await life.steps.reduce(
    (previous, step, index) => previous.then(() => runStep(runner, step, index)),
    Promise.resolve(),
  );

  if (deleteAccount && reads("accountDeleted") && runner.last) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: runner.goal.userId } });
    const kind = runner.library.fixture.goal.kind;
    const plan = toRulePlan({ inputs: runner.ruleInputs, kind, plan: runner.last });

    runner.violations.push(
      ...(await deleteSimLearner({ check, library: runner.library, plan, user })),
    );
  }

  return {
    events: runner.events,
    library: runner.library,
    plans: runner.plans,
    violations: rules
      ? runner.violations.filter((violation) => rules.includes(violation.rule))
      : runner.violations,
  };
}
