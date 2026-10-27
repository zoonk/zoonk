import { addDays, fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import {
  type RuleAnswer,
  type RuleContext,
  type RuleEvent,
  type RuleViolation,
} from "../rules/rule-context";
import {
  type SimStepLabel,
  type SimViolation,
  listAnnouncedSkillIds,
  listGapAreas,
  toRuleContext,
} from "./sim-context";
import { type SimInputs } from "./sim-inputs";
import { type SimLife, listAreas } from "./sim-life-plan";
import { refreshSimPlan } from "./sim-refresh";
import { type SimChange, type SimPlan, type SimWorld, emptySimPlan } from "./sim-world";

/** The owner rules' checks, or a subset of them. */
export type SimCheck = (context: RuleContext) => RuleViolation[];

/** A life in progress: the world the planner reads and what the run recorded so far. */
export type Runner = {
  answers: RuleAnswer[];
  check: SimCheck;
  inputs: SimInputs;
  life: SimLife;
  own: { count: number; ratio: number };
  /** Days a planning run already ran on: the first run of a day settles the days before it. */
  ranDays: Set<string>;
  start: Date;
  violations: SimViolation[];
  world: SimWorld;
};

type Recorded = {
  before: SimPlan | null;
  change: SimChange | null;
  event: RuleEvent;
  label: SimStepLabel;
  plan: SimPlan;
  step: number;
};

export function skillAt(runner: Pick<Runner, "inputs">, index: number): string {
  const { skills } = runner.inputs.library.graph;
  return skills[index % skills.length]?.skillId ?? "";
}

/** Saves a step's plan and change, and checks the owner's rules on it. */
export function record(runner: Runner, { before, change, event, label, plan, step }: Recorded) {
  const { world } = runner;
  const today = toIsoDate(world.today);

  const context = toRuleContext({
    after: plan,
    before,
    event,
    inputs: runner.inputs,
    kind: runner.inputs.goal.kind,
    learner: {
      announcedSkillIds: listAnnouncedSkillIds({
        announcements: runner.inputs.announcements,
        graph: plan.state.graph,
      }),
      answers: runner.answers,
      gapAreas: listGapAreas({
        graph: plan.state.graph,
        skillIds: world.learner.testAnswers.flatMap((answer) =>
          answer.kind === "test" && !answer.isCorrect ? [answer.skillId] : [],
        ),
      }),
      knownAreas: world.learner.knownSubjects,
      knownSkillIds: plan.knownSkillIds ?? [],
    },
    today: world.today,
    todayShown: world.sessions.has(today),
  });

  runner.world = { ...world, changes: change ? [...world.changes, change] : world.changes, plan };

  for (const violation of runner.check(context)) {
    runner.violations.push({ ...violation, label, step, today });
  }
}

export function refresh(
  runner: Runner,
  {
    event,
    label,
    pace,
    settleOnly = false,
    step,
  }: {
    event: RuleEvent;
    label: SimStepLabel;
    pace: "sampled" | "saved";
    settleOnly?: boolean;
    step: number;
  },
) {
  const before = runner.world.plan;
  const result = refreshSimPlan({ pace, settleOnly, world: runner.world });
  record(runner, { before, ...result, event, label, step });
}

export async function startRunner({
  check,
  inputs,
  life,
}: {
  check: SimCheck;
  inputs: SimInputs;
  life: SimLife;
}): Promise<Runner> {
  const areas = listAreas(inputs);
  const start = fromIsoDate(life.start);
  const pendingSkills = new Set(life.pending.map((index) => skillAt({ inputs }, index)));

  const targetDate =
    life.targetInDays === null ? null : toIsoDate(addDays(start, life.targetInDays));

  return {
    answers: [],
    check,
    inputs,
    life,
    own: { count: 0, ratio: life.speed },
    ranDays: new Set([life.start]),
    start,
    violations: [],
    world: {
      changes: [],
      inputs,
      learner: {
        knownSubjects: life.knownAreas.map((index) => areas[index % areas.length] ?? ""),
        own: null,
        readiness: new Map(),
        subscribed: life.subscribed,
        testAnswers: [],
      },
      lessons: await inputs.loadLessons(pendingSkills),
      pendingSkills,
      plan: emptySimPlan({ dailyMinutes: life.dailyMinutes, inputs, targetDate }),
      sessions: new Map(),
      today: start,
    },
  };
}
