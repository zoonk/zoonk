import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { withClassTestMock } from "../../exams/mocks/class-test-mock";
import { getWeeklyMockMinutes } from "../../exams/mocks/mock-plan";
import { examStructureSchema, topicFrequencySchema } from "../../library/exams/blueprint-contract";
import {
  type TopicLevel,
  type TopicPart,
  listTopicLevels,
  listTopicParts,
} from "../../library/exams/topic-frequency";
import { type ExamSubjectShare } from "../planner/plan-feasibility";
import { type PlanGraph } from "../planner/plan-state";
import { getAreaShares, getExamSubjectShares } from "./exam-subject-shares";

type ExamFacts = {
  /**
   * What the questions a class test's own material announces ask, as its formats describe them
   * ("Dissertativa sobre osmose"): a plan short on time keeps the lessons on them. Empty for a
   * public notice, whose formats say how the exam asks, not about what.
   */
  announcements: string[];
  /** Each area's share of the exam, when the notice states most subjects' (`getAreaShares`). */
  areaShares: Map<string, number> | null;
  /** The notice's subjects the plan teaches, with their share of the exam; null without them. */
  examSubjects: ExamSubjectShare[] | null;
  mockMinutes: number;
  shortMockMinutes: number | null;
  /** How often the exam asks its notice's topics, where its past papers or a lookup say. */
  topicLevels: TopicLevel[];
  /** The part of its subject each topic is listed under, where the notice groups them. */
  topicParts: TopicPart[];
};

/**
 * What the exam's notice tells the planner. How long its mocks take: the weekly mock, the first
 * exam day's sections at the real pace with half of each on regular weeks, as the exam module plans
 * it; and for a class test read from the learner's own material (a private blueprint), its short
 * mock at full length, which rehearses it the day before when the test is days away. What each
 * of its subjects is worth, so the plan's time and its coverage follow the exam's points, and how
 * often it asks each topic, so a plan short on time leaves out the ones asked least (see
 * `weighGraphByTopicFrequency`), and the parts its subjects' topics are grouped in, each of which a
 * plan short on time keeps (see `rankCores`); and for a class test, the questions its material
 * announces, whose lessons a plan short on time keeps (see `findAnnouncedLessonIds`).
 */
async function loadNoticeFacts({
  goal,
  graph,
}: {
  goal: Pick<Goal, "examBlueprintId">;
  graph: PlanGraph;
}): Promise<ExamFacts> {
  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({
        select: { ownerId: true, structure: true, topicFrequency: true },
        where: { id: goal.examBlueprintId },
      })
    : null;

  const parsed = examStructureSchema.safeParse(blueprint?.structure).data ?? null;
  const ownerId = blueprint?.ownerId ?? null;
  const structure = parsed && withClassTestMock({ ownerId, structure: parsed });
  const topicFrequency = topicFrequencySchema.safeParse(blueprint?.topicFrequency).data ?? [];

  return {
    announcements: ownerId ? (parsed?.formats ?? []).map((format) => format.description) : [],
    areaShares: parsed ? getAreaShares({ graph, structure: parsed }) : null,
    examSubjects: parsed ? getExamSubjectShares({ graph, structure: parsed }) : null,
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure }),
    shortMockMinutes: ownerId ? getWeeklyMockMinutes({ fullLength: true, structure }) : null,
    topicLevels: parsed ? listTopicLevels({ structure: parsed, topicFrequency }) : [],
    topicParts: parsed ? listTopicParts(parsed) : [],
  };
}

/** What a goal's exam tells the planner (see `loadNoticeFacts`); a goal that isn't an exam has none. */
export function loadExamFacts({
  goal,
  graph,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  graph: PlanGraph;
}): Promise<ExamFacts> | ExamFacts {
  if (goal.kind === "exam") {
    return loadNoticeFacts({ goal, graph });
  }

  return {
    announcements: [],
    areaShares: null,
    examSubjects: null,
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure: null }),
    shortMockMinutes: null,
    topicLevels: [],
    topicParts: [],
  };
}
