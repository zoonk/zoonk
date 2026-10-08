import "server-only";
import {
  type ExamBlueprint,
  type Goal,
  type MockExam,
  type MockExamAnswer,
  type StudySessionBlock,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import {
  type BlockPayload,
  readBlockPayload,
  toBlockPayload,
} from "../../../sessions/block-payload";
import { getSession } from "../../../users/get-session";
import { withClassTestMock } from "../class-test-mock";
import { type MockConditions, mockConditionsSchema } from "../mock-contract";
import { getAskedItemIds } from "./mock-sections";

export type MockSitting = Omit<MockExam, "conditions"> & {
  answers: MockExamAnswer[];
  conditions: MockConditions;
};

export type OwnedMock = {
  blueprint: ExamBlueprint | null;
  /** The session block of a mock the plan scheduled; null for one taken any time. */
  block: StudySessionBlock | null;
  goal: Goal | null;
  /** The sitting once the learner started it (a mock taken any time starts as it's made). */
  mock: MockSitting | null;
  payload: BlockPayload;
  /** The learner-local day it belongs to: its session's, or the day a mock taken any time began. */
  sessionDate: Date;
  structure: ExamStructure | null;
  userId: string;
};

export type OwnedMockResult =
  | { owned: OwnedMock; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

function toSitting(mock: (MockExam & { answers: MockExamAnswer[] }) | null): MockSitting | null {
  if (!mock) {
    return null;
  }

  // The mock wrote its own conditions; a row that doesn't parse is corrupted and fails loudly.
  return { ...mock, conditions: mockConditionsSchema.parse(mock.conditions) };
}

/** The sitting as it's stored now, such as once a finish holds the mock's lock. */
export async function findMockSitting(
  client: TransactionClient,
  mockId: string,
): Promise<MockSitting | null> {
  return toSitting(
    await client.mockExam.findUnique({ include: { answers: true }, where: { id: mockId } }),
  );
}

/** The structure a mock copies: the blueprint's, or a short test for a class test's. */
function readMockStructure(blueprint: ExamBlueprint | null): ExamStructure | null {
  return blueprint
    ? withClassTestMock({
        ownerId: blueprint.ownerId,
        structure: readBlueprintContent(blueprint).structure,
      })
    : null;
}

async function findScheduledMock({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<OwnedMock | null> {
  const block = await prisma.studySessionBlock.findFirst({
    include: {
      mockExam: { include: { answers: true } },
      session: { include: { goal: { include: { examBlueprint: true } } } },
    },
    where: { id, kind: "checkpoint", session: { userId } },
  });

  const payload = block ? readBlockPayload(block) : null;

  if (!block || !payload?.checkpoint?.mock) {
    return null;
  }

  const { mockExam, session: studySession, ...row } = block;
  const blueprint = studySession.goal?.examBlueprint ?? null;

  return {
    block: row,
    blueprint,
    goal: studySession.goal,
    mock: toSitting(mockExam),
    payload,
    sessionDate: studySession.localDate,
    structure: readMockStructure(blueprint),
    userId,
  };
}

/**
 * A mock taken any time has no session block: it's its own row, started as it was made, whose
 * conditions hold every question it asks.
 */
async function findAnytimeMock({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<OwnedMock | null> {
  const row = await prisma.mockExam.findFirst({
    include: { answers: true, examBlueprint: true, goal: true },
    where: { blockId: null, id, userId },
  });

  if (!row) {
    return null;
  }

  const { examBlueprint, goal, ...rest } = row;
  const mock = toSitting(rest);

  if (!mock) {
    return null;
  }

  const itemIds = getAskedItemIds(mock.conditions).map((entry) => entry.itemId);
  const timeZone = getAnswerTimeZone({ goal });

  return {
    block: null,
    blueprint: examBlueprint,
    goal,
    mock,
    payload: toBlockPayload({ itemIds }),
    sessionDate: getDateInTimeZone({ date: mock.startedAt, timeZone }),
    structure: readMockStructure(examBlueprint),
    userId,
  };
}

/**
 * One of the signed-in learner's mock exams, by the id it opens by: the session block of a mock
 * the plan scheduled (a checkpoint block of an exam goal whose weekly Big Challenge is a mock), or
 * the mock's own id for one taken any time. Another learner's mock, or a checkpoint that isn't a
 * mock, is "not found".
 */
export async function findOwnedMock(id: string): Promise<OwnedMockResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (!isUuid(id)) {
    return { status: "notFound" };
  }

  const owned =
    (await findScheduledMock({ id, userId })) ?? (await findAnytimeMock({ id, userId }));

  return owned ? { owned, status: "ready" } : { status: "notFound" };
}

const MS_PER_MINUTE = 60_000;

/** When the current section's time runs out. */
export function getSectionDeadline(mock: MockSitting): Date {
  const minutes = mock.conditions.sections[mock.sectionIndex]?.minutes ?? 0;
  return new Date(mock.sectionStartedAt.getTime() + minutes * MS_PER_MINUTE);
}
