import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type ExamChoice, toChosenStructure } from "../../exams/choices/exam-choices";
import { getWeeklyMockMinutes, listMockClocks } from "../../exams/mocks/mock-plan";
import { toMockStructure } from "../../exams/mocks/mock-structure";
import {
  examEditionSchema,
  examStructureSchema,
  topicFrequencySchema,
} from "../../library/exams/blueprint-contract";
import { listAnnouncedQuestions } from "../../library/exams/material-formats";
import { type TopicLevel, listTopicLevels } from "../../library/exams/topic-frequency";
import { type MockClock } from "../planner/mock-identity";
import { type PlanGraph } from "../planner/plan-state";
import { type ExamSubjectShare } from "../planner/selected-coverage";
import { getAreaShares, getExamSubjectShares } from "./exam-subject-shares";

type ExamFacts = {
  announcements: string[];
  areaShares: Map<string, number> | null;
  examSubjects: ExamSubjectShare[] | null;
  fullMockMinutes: number;
  mockClocks: MockClock[];
  mockMinutes: number;
  shortMockMinutes: number | null;
  topicLevels: TopicLevel[];
};

type NoticeBlueprint = Pick<ExamBlueprint, "edition" | "ownerId" | "structure" | "topicFrequency">;

function readNoticeBlueprint(goal: Pick<Goal, "examBlueprintId">) {
  return goal.examBlueprintId
    ? prisma.examBlueprint.findUnique({
        select: { edition: true, ownerId: true, structure: true, topicFrequency: true },
        where: { id: goal.examBlueprintId },
      })
    : null;
}

async function loadNoticeFacts({
  blueprint: known,
  choices,
  goal,
  graph,
}: {
  blueprint?: NoticeBlueprint | null;
  choices: readonly ExamChoice[];
  goal: Pick<Goal, "examBlueprintId">;
  graph: PlanGraph;
}): Promise<ExamFacts> {
  const blueprint = known === undefined ? await readNoticeBlueprint(goal) : known;

  const stored = examStructureSchema.safeParse(blueprint?.structure).data;

  const parsed = stored ? toChosenStructure({ choices, structure: stored }) : null;
  const ownerId = blueprint?.ownerId ?? null;
  const noticeQuestions = examEditionSchema.safeParse(blueprint?.edition).data?.questionCount;

  const structure =
    parsed &&
    toMockStructure({ noticeQuestions: noticeQuestions ?? null, ownerId, structure: parsed });

  const topicFrequency = topicFrequencySchema.safeParse(blueprint?.topicFrequency).data ?? [];

  return {
    announcements: ownerId ? listAnnouncedQuestions(parsed?.formats ?? []) : [],
    areaShares: parsed ? getAreaShares({ graph, structure: parsed }) : null,
    examSubjects: parsed ? getExamSubjectShares({ graph, structure: parsed }) : null,
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure }),
    mockClocks: listMockClocks(structure),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure }),
    shortMockMinutes: ownerId ? getWeeklyMockMinutes({ fullLength: true, structure }) : null,
    topicLevels: parsed ? listTopicLevels({ structure: parsed, topicFrequency }) : [],
  };
}

export function loadExamFacts({
  blueprint,
  choices = [],
  goal,
  graph,
}: {
  blueprint?: NoticeBlueprint | null;
  choices?: readonly ExamChoice[];
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  graph: PlanGraph;
}): Promise<ExamFacts> | ExamFacts {
  if (goal.kind === "exam") {
    return loadNoticeFacts({ blueprint, choices, goal, graph });
  }

  return {
    announcements: [],
    areaShares: null,
    examSubjects: null,
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure: null }),
    mockClocks: listMockClocks(null),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure: null }),
    shortMockMinutes: null,
    topicLevels: [],
  };
}
