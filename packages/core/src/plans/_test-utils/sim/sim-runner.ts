import { getSkillArea } from "../../planner/graph-areas";
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
  listLearnerChanges,
  toRuleContext,
  toSimChangeView,
} from "./sim-context";
import { type SimInputs } from "./sim-inputs";
import { type SimLibrary } from "./sim-library";
import { type SimLife, listAreas } from "./sim-life-plan";
import { findWaitingProposal } from "./sim-phase-dates";
import { refreshSimPlan } from "./sim-refresh";
import { type SimChange, type SimPlan, type SimWorld, emptySimPlan } from "./sim-world";

/** The owner rules' checks, or a subset of them. */
export type SimCheck = (context: RuleContext) => RuleViolation[];

type SimEvent = {
  change: SimChange | null;
  event: RuleEvent;
  label: SimStepLabel;
  step: number;
  today: string;
  /** Whether Today shows a proposal to move the phase dates after the step. */
  waiting: boolean;
};

export type SimResult = {
  events: SimEvent[];
  library: SimLibrary;
  /** The plan after each event, with `trace`. */
  plans: SimPlan[];
  violations: SimViolation[];
};

/** A life in progress: the world the planner reads and what the run recorded so far. */
export type Runner = {
  answers: RuleAnswer[];
  areas: string[];
  check: SimCheck;
  events: SimEvent[];
  inputs: SimInputs;
  life: SimLife;
  own: { count: number; ratio: number };
  plans: SimPlan[];
  /** The learner finished something since the plan was last planned. */
  progressed: boolean;
  /** Days a planning run already ran on: the first run of a day settles the days before it. */
  ranDays: Set<string>;
  start: Date;
  trace: boolean;
  violations: SimViolation[];
  world: SimWorld;
};

/**
 * A refresh after the learner finished something the plan wasn't planned with since (a partial
 * session plans nothing, an open that settles nothing doesn't plan) is the first run to see it.
 */
function withProgress({ event, progressed }: { event: RuleEvent; progressed: boolean }): RuleEvent {
  return event.kind === "refresh" && progressed ? { ...event, progressed } : event;
}

export type Recorded = {
  /** For a change: the plan re-planned without it, to tell drift from the change's own doing. */
  baseline?: SimPlan;
  before: SimPlan | null;
  change: SimChange | null;
  event: RuleEvent;
  label: SimStepLabel;
  plan: SimPlan;
  /** Other changes the step wrote: a proposal to move the phase dates, or the waiting one it replaced. */
  proposals?: SimChange[];
  step: number;
};

const STEERING_RULES = new Set(["R1", "R2", "R4"]);

export function skillAt(runner: Pick<Runner, "inputs">, index: number): string {
  const { skills } = runner.inputs.library.graph;
  return skills[index % skills.length]?.skillId ?? "";
}

/** Lesson-weighted lessons still to do per area. */
function countAreaLessons(plan: SimPlan): Map<string, number> {
  const { graph } = plan.state;

  const areas = new Map(
    graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

  return plan.items
    .filter((item) => item.kind === "lesson" && item.status === "todo")
    .reduce((counts, item) => {
      const area = areas.get(item.skillId ?? "") ?? "";
      return counts.set(area, (counts.get(area) ?? 0) + (item.lessonId ? 1 : (item.lessons ?? 1)));
    }, new Map<string, number>());
}

/**
 * Each area whose lessons a change moved, before it, re-planned without it and after it: when
 * re-planning alone moves them, the plan drifted; otherwise the change did it.
 */
function describeSteering(plans: { after: SimPlan; baseline: SimPlan; before: SimPlan }) {
  const counts = [plans.before, plans.baseline, plans.after].map((plan) => countAreaLessons(plan));
  const areas = new Set(counts.flatMap((map) => [...map.keys()]));

  return Object.fromEntries(
    [...areas].flatMap((area) => {
      const [was = 0, replanned = 0, now = 0] = counts.map((map) => map.get(area) ?? 0);

      return was === replanned && replanned === now
        ? []
        : [[area, { after: now, before: was, replanned }]];
    }),
  );
}

/** Saves a step's plan and change, and checks the owner's rules on it. */
export function record(
  runner: Runner,
  { baseline, before, change, event: stepEvent, label, plan, proposals = [], step }: Recorded,
) {
  const { world } = runner;
  const today = toIsoDate(world.today);
  const event = withProgress({ event: stepEvent, progressed: runner.progressed });

  // A planning run that saved the plan saw what the learner finished so far.
  if (plan.version !== before?.version) {
    runner.progressed = false;
  }

  const written = [...(change ? [change] : []), ...proposals];

  const changes = written.map((entry, index) =>
    toSimChangeView({
      change: entry,
      goal: runner.inputs.library.fixture.goal,
      index: world.changes.length + index,
    }),
  );

  const recorded = [...world.changes, ...written];
  const waiting = findWaitingProposal(recorded);

  const context = toRuleContext({
    after: plan,
    before,
    changes,
    declined: world.changes.flatMap((entry, index) =>
      entry.status === "declined"
        ? [toSimChangeView({ change: entry, goal: runner.inputs.library.fixture.goal, index })]
        : [],
    ),
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
      listeningSkillIds: [...runner.inputs.listeningSkillIds],
      plus: world.learner.subscribed,
    },
    learnerChanges: listLearnerChanges(recorded),
    today: world.today,
    todayShown: world.sessions.has(today),
    waiting: waiting
      ? [
          toSimChangeView({
            change: waiting,
            goal: runner.inputs.library.fixture.goal,
            index: recorded.indexOf(waiting),
          }),
        ]
      : [],
  });

  runner.world = { ...world, changes: recorded, plan };

  runner.events.push({ change, event, label, step, today, waiting: waiting !== undefined });

  if (runner.trace) {
    runner.plans.push(plan);
  }

  for (const violation of runner.check(context)) {
    const steering =
      baseline && before && STEERING_RULES.has(violation.rule)
        ? { lessonsByArea: describeSteering({ after: plan, baseline, before }) }
        : {};

    runner.violations.push({
      ...violation,
      details: { ...violation.details, ...steering },
      label,
      step,
      today,
    });
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
  trace,
}: {
  check: SimCheck;
  inputs: SimInputs;
  life: SimLife;
  trace: boolean;
}): Promise<Runner> {
  const areas = listAreas(inputs);
  const start = fromIsoDate(life.start);
  const pendingSkills = new Set(life.pending.map((index) => skillAt({ inputs }, index)));

  const targetDate =
    life.targetInDays === null ? null : toIsoDate(addDays(start, life.targetInDays));

  return {
    answers: [],
    areas,
    check,
    events: [],
    inputs,
    life,
    own: { count: 0, ratio: life.speed },
    plans: [],
    progressed: false,
    ranDays: new Set([life.start]),
    start,
    trace,
    violations: [],
    world: {
      changes: [],
      inputs,
      landedLessons: [],
      learner: {
        knownSubjects: life.knownAreas.map((index) => areas[index % areas.length] ?? ""),
        own: null,
        ownLevel: life.ownLevel ?? null,
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
