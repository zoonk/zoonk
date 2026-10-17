import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type ExamChoice, toChosenStructure } from "../../exams/choices/exam-choices";
import { getWeeklyMockMinutes, listMockClocks } from "../../exams/mocks/mock-plan";
import { toMockStructure } from "../../exams/mocks/mock-structure";
import {
  type ExamStructure,
  examEditionSchema,
  examStructureSchema,
  topicFrequencySchema,
} from "../../library/exams/blueprint-contract";
import { listAnnouncedQuestions } from "../../library/exams/material-formats";
import { type TopicLevel, listTopicLevels } from "../../library/exams/topic-frequency";
import { type ExamSubjectShare } from "../planner/feasibility-coverage";
import { type MockClock } from "../planner/mock-identity";
import { type PlanGraph } from "../planner/plan-state";
import { getAreaShares, getExamSubjectShares } from "./exam-subject-shares";

type ExamFacts = {
  /**
   * What the questions a class test's own material announces ask, as its formats describe them
   * and as the passages they quote say (see `listAnnouncedQuestions`): a plan short on time keeps
   * the lessons on them. Empty for a public notice, whose formats say how the exam asks, not about
   * what.
   */
  announcements: string[];
  /** Each area's share of the exam, when the notice states most subjects' (`getAreaShares`). */
  areaShares: Map<string, number> | null;
  /** The notice's subjects the plan teaches, with their share of the exam; null without them. */
  examSubjects: ExamSubjectShare[] | null;
  /** The final stretch's mock: the real exam day, its written test included. */
  fullMockMinutes: number;
  /** The weekly mock on regular weeks: half the exam's first day. */
  /** Each exam day's mock clock, in the order the plan's mocks take turns (see `MockClock`). */
  mockClocks: MockClock[];
  mockMinutes: number;
  shortMockMinutes: number | null;
  /** How often the exam asks its notice's topics, where its past papers or a lookup say. */
  topicLevels: TopicLevel[];
};

type NoticeBlueprint = Pick<ExamBlueprint, "edition" | "ownerId" | "structure">;

/**
 * The exam as the learner takes it, only the options they picked of its choices counting
 * (`parsed`), and as its mocks rehearse it (`structure`, see `toMockStructure`).
 */
function readNoticeStructure({
  blueprint,
  choices,
}: {
  blueprint: NoticeBlueprint | null;
  choices: readonly ExamChoice[];
}) {
  const stored = examStructureSchema.safeParse(blueprint?.structure).data;
  const parsed = stored ? toChosenStructure({ choices, structure: stored }) : null;
  const ownerId = blueprint?.ownerId ?? null;
  const noticeQuestions = examEditionSchema.safeParse(blueprint?.edition).data?.questionCount;

  const structure =
    parsed &&
    toMockStructure({ noticeQuestions: noticeQuestions ?? null, ownerId, structure: parsed });

  return { ownerId, parsed, structure };
}

/**
 * How the plan's mocks run: the weekly mock takes half the exam's first day, all of it in the final
 * stretch, and each exam day's mock its own clock (see `listMockClocks`).
 */
function getMockFacts(structure: ExamStructure | null) {
  return {
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure }),
    mockClocks: listMockClocks(structure),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure }),
  };
}

/**
 * How a goal's mocks run in its plan's runs (see `loadNoticeFacts`), from its exam's blueprint as
 * already loaded: the challenge screen lays out the next run's days and funds their mocks with it.
 */
export function readMockFacts({
  blueprint,
  choices,
}: {
  blueprint: NoticeBlueprint | null;
  choices: readonly ExamChoice[];
}) {
  return getMockFacts(readNoticeStructure({ blueprint, choices }).structure);
}

/**
 * What the exam's notice tells the planner. How long its mocks take: the weekly mock, the first
 * exam day's sections at the real pace with half of each on regular weeks and the whole day, its
 * written test included, in the final stretch, as the exam module plans it; and for a class test read from the learner's own material (a private blueprint), its short
 * mock at full length, which rehearses it the day before when the test is days away. What each
 * of its subjects is worth, so the plan's time and its coverage follow the exam's points, and how
 * often it asks each topic, so a plan short on time leaves out the ones asked least (see
 * `weighGraphByTopicFrequency`), and the parts its subjects' topics are grouped in, each of which a
 * plan short on time keeps (see `rankCores`); and for a class test, the questions its material
 * announces, whose lessons a plan short on time keeps (see `findAnnouncedLessonIds`).
 */
async function loadNoticeFacts({
  choices,
  goal,
  graph,
}: {
  choices: readonly ExamChoice[];
  goal: Pick<Goal, "examBlueprintId">;
  graph: PlanGraph;
}): Promise<ExamFacts> {
  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({
        select: { edition: true, ownerId: true, structure: true, topicFrequency: true },
        where: { id: goal.examBlueprintId },
      })
    : null;

  const { ownerId, parsed, structure } = readNoticeStructure({ blueprint, choices });
  const topicFrequency = topicFrequencySchema.safeParse(blueprint?.topicFrequency).data ?? [];

  return {
    announcements: ownerId ? listAnnouncedQuestions(parsed?.formats ?? []) : [],
    areaShares: parsed ? getAreaShares({ graph, structure: parsed }) : null,
    examSubjects: parsed ? getExamSubjectShares({ graph, structure: parsed }) : null,
    ...getMockFacts(structure),
    shortMockMinutes: ownerId ? getWeeklyMockMinutes({ fullLength: true, structure }) : null,
    topicLevels: parsed ? listTopicLevels({ structure: parsed, topicFrequency }) : [],
  };
}

/**
 * What a goal's exam tells the planner (see `loadNoticeFacts`), counting only the options the
 * learner picked of its choices (`choices`, the plan's `examChoices`; none picked by default); a
 * goal that isn't an exam has none.
 */
export function loadExamFacts({
  choices = [],
  goal,
  graph,
}: {
  choices?: readonly ExamChoice[];
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  graph: PlanGraph;
}): Promise<ExamFacts> | ExamFacts {
  if (goal.kind === "exam") {
    return loadNoticeFacts({ choices, goal, graph });
  }

  return {
    announcements: [],
    areaShares: null,
    examSubjects: null,
    ...getMockFacts(null),
    shortMockMinutes: null,
    topicLevels: [],
  };
}
