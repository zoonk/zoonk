import { type Goal, type Plan, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../../_test-utils/mock-session";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { loadSkillPrerequisites } from "../../../library/skills/skill-prerequisites";
import { getSyllabusView } from "../../../view-models/syllabus/get-syllabus-view";
import { getGoalPlan } from "../../get-goal-plan";
import { addDays, fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import { type RuleAnswer, type RuleContext, type RuleEvent } from "../rules/rule-context";
import {
  type SimStepLabel,
  type SimViolation,
  listAnnouncedSkillIds,
  listGapAreas,
  listLearnerChanges,
  toRuleContext,
} from "./sim-context";
import { readPlannedKnown, watchPlannerReads } from "./sim-db-known";
import { listSimLessons, writeSimLessons } from "./sim-db-lessons";
import { keepPaceOwn } from "./sim-db-pace";
import { readSimSessions, seedSimQuestions } from "./sim-db-questions";
import {
  readNewChanges,
  readProposals,
  readSimPlan,
  readSimPreparation,
  setSimToday,
  tickSimClock,
} from "./sim-db-reads";
import { type SimInputs, loadSimInputs } from "./sim-inputs";
import {
  type SimLibrary,
  createOwnBlueprint,
  listTaughtBy,
  seedSimLibraryCopy,
} from "./sim-library";
import { type SimLife, listAreas } from "./sim-life-plan";
import { type SimCheck, type SimResult, withProgress } from "./sim-runner";
import { type SimPlan } from "./sim-world";

/** A life in progress through the real capabilities, and what the run recorded so far. */
export type DbRunner = {
  answers: RuleAnswer[];
  areas: string[];
  check: SimCheck;
  events: SimResult["events"];
  /** Every lesson the learner finished through the lesson player so far, oldest first. */
  finishedLessons: NonNullable<RuleContext["finishedLessons"]>[number][];
  goal: Goal;
  knownAreas: string[];
  /** The changes the learner made or applied so far, on their day. */
  learnerChanges: ReturnType<typeof listLearnerChanges>;
  /** The plan as the last step left it. */
  last: SimPlan | null;
  library: SimLibrary;
  life: SimLife;
  missed: Set<string>;
  opened: Set<string>;
  plan: Pick<Plan, "id">;
  plans: SimPlan[];
  /** The learner finished something since the plan was last planned. */
  progressed: boolean;
  /** The library has a question bank (see `seedSimQuestions`) and written lessons (`writeSimLessons`). */
  questions: boolean;
  /** Days a planning run already ran on: the first run of a day settles the days before it. */
  ranDays: Set<string>;
  /**
   * What the life reads after each step for the rules its test asserts (see `RULES_READING`): the
   * plan and syllabus screens, and readiness.
   */
  reads: { preparation: boolean; screens: boolean };
  /** What the checks read of the Library, by the ids of the life's own copy. */
  ruleInputs: Pick<SimInputs, "announcements" | "prerequisites" | "taughtBy" | "topicLevels">;
  seen: Map<string, string>;
  today: Date;
  trace: boolean;
  violations: SimViolation[];
};

/** The skill at an index of the life's library copy's graph. */
export function skillAtDb(runner: Pick<DbRunner, "library">, index: number): string {
  const { skills } = runner.library.graph;
  return skills[index % skills.length]?.skillId ?? "";
}

/** Reads the step's plan and changes from the database and checks the owner's rules on them. */
export async function recordDb(
  runner: DbRunner,
  { event: stepEvent, label, step }: { event: RuleEvent; label: SimStepLabel; step: number },
) {
  const day = toIsoDate(runner.today);
  const todayShown = runner.opened.has(day);
  const before = runner.last;
  const goalId = runner.goal.id;
  // The plan carries what its last run read the learner knew, as the pure tier's do.
  const after = { ...(await readSimPlan(goalId)), knownSkillIds: readPlannedKnown(goalId) };
  const event = withProgress({ event: stepEvent, progressed: runner.progressed });

  // A planning run that saved the plan saw what the learner finished so far.
  if (after.version !== before?.version) {
    runner.progressed = false;
  }

  // What the plan and syllabus screens say after the step, for the checks of what's shown.
  const [
    { changes, views, waiting },
    declined,
    proposed,
    planView,
    syllabusView,
    sessions,
    preparation,
    listening,
  ] = await Promise.all([
    readNewChanges({ planId: runner.plan.id, seen: runner.seen }),
    readProposals({ planId: runner.plan.id, status: "declined" }),
    readProposals({ planId: runner.plan.id, status: "proposed" }),
    runner.reads.screens ? getGoalPlan(goalId) : undefined,
    runner.reads.screens ? getSyllabusView({ goalId }) : undefined,
    // Without questions no session asks anything: the checks of practice would read that as none.
    runner.questions ? readSimSessions(goalId) : undefined,
    // Nor does readiness have anything to count.
    runner.questions && runner.reads.preparation ? readSimPreparation(goalId) : undefined,
    loadListeningSkillIds(goalId),
  ]);

  const change = changes.findLast((entry) => entry.status === "applied") ?? changes.at(-1) ?? null;

  runner.last = after;
  runner.learnerChanges.push(...listLearnerChanges(changes));
  runner.events.push({ change, event, label, step, today: day, waiting });
  tickSimClock();

  if (runner.trace) {
    runner.plans.push(after);
  }

  const context = toRuleContext({
    after,
    before,
    changes: views,
    declined,
    event,
    // Only lessons the lesson player finished say when they come back.
    finishedLessons: runner.questions ? runner.finishedLessons : undefined,
    inputs: runner.ruleInputs,
    kind: runner.library.fixture.goal.kind,
    learner: {
      announcedSkillIds: listAnnouncedSkillIds({
        announcements: runner.ruleInputs.announcements,
        graph: after.state.graph,
      }),
      answers: runner.answers,
      gapAreas: listGapAreas({ graph: after.state.graph, skillIds: runner.missed }),
      knownAreas: runner.knownAreas,
      knownSkillIds: after.knownSkillIds,
      listeningSkillIds: [...listening],
      plus: runner.life.subscribed,
    },
    learnerChanges: runner.learnerChanges,
    preparation,
    sessions,
    syllabus: syllabusView?.status === "ready" ? syllabusView.syllabus : undefined,
    today: runner.today,
    todayShown,
    view: planView?.status === "ready" ? planView.plan : undefined,
    waiting: proposed,
  });

  const violations = runner
    .check(context)
    .map((violation) => ({ ...violation, label, step, today: day }));

  runner.violations.push(...violations);
}

/** A learner with a goal on a life's own library copy, its plan not built yet. */
export async function startDbRunner({
  check,
  life,
  questions,
  reads,
  trace,
}: {
  check: SimCheck;
  life: SimLife;
  questions: boolean;
  reads: DbRunner["reads"];
  trace: boolean;
}): Promise<DbRunner> {
  const inputs = await loadSimInputs(life.fixture);
  const { skills } = inputs.library.fixture.graph;
  const areas = listAreas(inputs);
  const knownAreas = life.knownAreas.map((index) => areas[index % areas.length] ?? "");

  const pending = new Set(
    life.pending.map((index) => skills[index % skills.length]?.skillId ?? ""),
  );

  await keepPaceOwn();
  await watchPlannerReads();
  const user = await userFixture();
  const library = await seedSimLibraryCopy({ name: life.fixture, namespace: user.id, pending });
  const { fixture } = library;
  const start = fromIsoDate(life.start);

  if (questions) {
    await seedSimQuestions(library);
    await writeSimLessons({ lessons: listSimLessons(library), library });
  }

  const examBlueprintId = fixture.blueprint?.owned
    ? await createOwnBlueprint({ library, ownerId: user.id })
    : library.blueprintId;

  setSimToday(life.start);

  const goal = await goalFixture({
    dailyMinutes: life.dailyMinutes,
    details: {
      ...fixture.goal.details,
      knownSubjects: knownAreas,
      ...(life.ownLevel && { level: life.ownLevel }),
    },
    examBlueprintId,
    kind: fixture.goal.kind,
    language: fixture.goal.language,
    primaryCourseId: library.primaryCourseId,
    targetDate: life.targetInDays === null ? null : addDays(start, life.targetInDays),
    targetLanguage: fixture.goal.targetLanguage,
    timezone: "UTC",
    userId: user.id,
  });

  const [plan, prerequisites] = await Promise.all([
    planFixture({ goalId: goal.id, phases: [], settings: {} }),
    loadSkillPrerequisites(library.graph.skills.map((skill) => skill.skillId)),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    // A Plus learner's mocks, exam days past the free trial and limits come from their subscription.
    life.subscribed
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : null,
  ]);

  mockSession(user.id);

  return {
    answers: [],
    areas,
    check,
    events: [],
    finishedLessons: [],
    goal,
    knownAreas,
    last: null,
    learnerChanges: [],
    library,
    life,
    missed: new Set(),
    opened: new Set(),
    plan,
    plans: [],
    progressed: false,
    questions,
    ranDays: new Set([life.start]),
    reads,
    ruleInputs: {
      announcements: inputs.announcements,
      prerequisites,
      // The life's own copy of the Library: its rows have their own ids.
      taughtBy: listTaughtBy(library),
      topicLevels: inputs.topicLevels,
    },
    seen: new Map(),
    today: start,
    trace,
    violations: [],
  };
}
