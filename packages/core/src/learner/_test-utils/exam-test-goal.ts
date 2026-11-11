import { type Item, type Skill } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../_test-utils/mock-session";
import { type answerPlacementQuestion } from "../placement/answer-placement-question";
import { getGoalPlacement } from "../placement/get-goal-placement";
import { startPlacementSitting } from "../placement/start-placement-sitting";

const CITATION = { passage: "passage", sourceId: "source" };

type TestSubject = {
  /** Questions ready per topic; 2 unless given. */
  items?: number;
  name: string;
  /** The subject's questions in past exams, which is its share of the exam. */
  questions: number;
  /** Topics the plan studies in it; 1 unless given. */
  skills?: number;
};

type GoalAttrs = Parameters<typeof goalFixture>[0];

/** Onboarding up to the Focus test: the daily time and the plan are still ahead. */
const AT_THE_TEST = ["target", "level", "targetDate", "buddy"];

/** A goal past its setup, whose plan the learner has seen. */
export const PLAN_SHOWN = {
  details: { answered: [...AT_THE_TEST, "placement", "schedule"] },
  planRevealedAt: new Date("2030-01-01T00:00:00Z"),
};

/**
 * An exam goal at the Focus test's step of onboarding, whose notice lists `subjects`, each a plan
 * area with its topics and ready questions, signed in as its learner. The first option of every
 * question is the right one.
 */
export async function examTestGoalFixture({
  coveredShare = null,
  goal: goalAttrs = {},
  subjects,
}: {
  /** Below 1, the plan's time doesn't cover everything by the date. */
  coveredShare?: number | null;
  goal?: Partial<Omit<GoalAttrs, "userId">>;
  subjects: TestSubject[];
}) {
  const [user, blueprint] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      name: "Concurso",
      structure: {
        formats: [
          {
            citation: CITATION,
            description: "Múltipla escolha",
            kind: "multipleChoice",
            options: null,
          },
        ],
        mock: null,
        pastQuestions: {
          checkedAt: new Date().toISOString(),
          edition: null,
          source: { title: null, url: "https://example.com/exam" },
          subjects: subjects.map(({ name, questions }) => ({ name, questions })),
        },
        rules: [],
        subjects: subjects.map(({ name }) => ({
          citation: CITATION,
          name,
          questions: null,
          topics: [],
          weight: null,
        })),
      },
    }),
  ]);

  const goal = await goalFixture({
    details: { answered: AT_THE_TEST },
    examBlueprintId: blueprint.id,
    kind: "exam",
    planRevealedAt: null,
    targetDate: new Date("2031-06-01T00:00:00Z"),
    ...goalAttrs,
    userId: user.id,
  });

  const areas = await Promise.all(
    subjects.map(async (subject) => ({
      name: subject.name,
      skills: await Promise.all(
        Array.from({ length: subject.skills ?? 1 }, (_, index) =>
          skillFixture({ name: `${subject.name} ${index + 1} ${crypto.randomUUID()}` }),
        ),
      ),
      subject,
    })),
  );

  const skills: (Skill & { area: string })[] = areas.flatMap((area) =>
    area.skills.map((skill) => ({ ...skill, area: area.name })),
  );

  const plan = await planFixture({
    coveredShare,
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Phase 1" }],
      skills: skills.map((skill) => ({
        area: skill.area,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
    placementPreparedAt: new Date(),
  });

  const [items] = await Promise.all([
    Promise.all(
      areas.flatMap((area) =>
        area.skills.flatMap((skill) =>
          Array.from({ length: area.subject.items ?? 2 }, () =>
            itemFixture({
              content: choiceItemContent(),
              examBlueprintId: blueprint.id,
              skillId: skill.id,
            }),
          ),
        ),
      ),
    ),
    Promise.all(
      skills.map((skill, position) =>
        planItemFixture({ phase: 0, planId: plan.id, position, skillId: skill.id }),
      ),
    ),
  ]);

  mockSession(user.id);

  const subjectOf = new Map(skills.map((skill) => [skill.id, skill.area]));

  return {
    blueprint,
    goal,
    items: items satisfies Item[],
    plan,
    skills,
    /** The subject a question's topic belongs to. */
    subjectOf: (skillId: string | undefined) => subjectOf.get(skillId ?? "") ?? null,
    user,
  };
}

type Answered = Awaited<ReturnType<typeof answerPlacementQuestion>>;

export type TestPlacement = Extract<Answered, { status: "ready" }>["placement"];

/**
 * The state a learner answers from: an exam goal asks only inside a sitting, so one is started
 * (or the open one continued); any other goal is read as it is.
 */
export async function askPlacement(goalId: string): Promise<TestPlacement | null> {
  const started = await startPlacementSitting({ goalId, input: {} });
  const result = started.status === "unavailable" ? await getGoalPlacement({ goalId }) : started;

  return result.status === "ready" ? result.placement : null;
}

/** Starts or continues the test and returns its state. */
export async function startSitting(goalId: string): Promise<TestPlacement> {
  const result = await startPlacementSitting({ goalId, input: {} });

  if (result.status !== "ready") {
    throw new Error(`The sitting didn't start: ${result.status}`);
  }

  return result.placement;
}
