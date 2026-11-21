import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type ExamPicks, NO_EXAM_PICKS, toChosenStructure } from "../../exams/choices/exam-choices";
import { getWeeklyMockMinutes, listMockClocks } from "../../exams/mocks/mock-plan";
import { toMockStructure } from "../../exams/mocks/mock-structure";
import { getWritingSkillIds } from "../../learner/writing-skills";
import {
  type ExamStructure,
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
  writtenSkillIds?: string[];
  writingNotice?: { classTest: boolean; picks: ExamPicks; structure: ExamStructure };
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

function readQuestionCount(blueprint: NoticeBlueprint | null) {
  return examEditionSchema.safeParse(blueprint?.edition).data?.questionCount ?? null;
}

async function loadNoticeFacts({
  blueprint: known,
  goal,
  graph,
  picks,
}: {
  blueprint?: NoticeBlueprint | null;
  goal: Pick<Goal, "examBlueprintId">;
  graph: PlanGraph;
  picks: ExamPicks;
}): Promise<ExamFacts> {
  const blueprint = known === undefined ? await readNoticeBlueprint(goal) : known;

  const stored = examStructureSchema.safeParse(blueprint?.structure).data ?? null;

  const parsed = stored && toChosenStructure({ picks, structure: stored });
  const ownerId = blueprint?.ownerId ?? null;
  const noticeQuestions = readQuestionCount(blueprint);

  const structure = parsed && toMockStructure({ noticeQuestions, ownerId, structure: parsed });

  const topicFrequency = topicFrequencySchema.safeParse(blueprint?.topicFrequency).data ?? [];

  return {
    announcements: ownerId ? listAnnouncedQuestions(parsed?.formats ?? []) : [],
    areaShares: parsed ? getAreaShares({ graph, structure: parsed }) : null,
    examSubjects: parsed ? getExamSubjectShares({ graph, structure: parsed }) : null,
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure }),
    mockClocks: listMockClocks(structure),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure }),
    shortMockMinutes: ownerId ? getWeeklyMockMinutes({ fullLength: true, structure }) : null,
    writtenSkillIds: [...getWritingSkillIds({ graph, structure: stored })],
    ...(stored && { writingNotice: { classTest: Boolean(ownerId), picks, structure: stored } }),
    topicLevels: parsed ? listTopicLevels({ structure: parsed, topicFrequency }) : [],
  };
}

export function loadExamFacts({
  blueprint,
  goal,
  graph,
  picks = NO_EXAM_PICKS,
}: {
  blueprint?: NoticeBlueprint | null;
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  graph: PlanGraph;
  picks?: ExamPicks;
}): Promise<ExamFacts> | ExamFacts {
  if (goal.kind === "exam") {
    return loadNoticeFacts({ blueprint, goal, graph, picks });
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
