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
import { isUuid } from "@zoonk/utils/uuid";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type BlockPayload, readBlockPayload } from "../../../sessions/block-payload";
import { getSession } from "../../../users/get-session";
import { withClassTestMock } from "../class-test-mock";
import { type MockConditions, mockConditionsSchema } from "../mock-contract";

export type MockSitting = Omit<MockExam, "conditions"> & {
  answers: MockExamAnswer[];
  conditions: MockConditions;
};

export type OwnedMock = {
  blueprint: ExamBlueprint | null;
  block: StudySessionBlock;
  goal: Goal | null;
  /** The sitting once the learner started it. */
  mock: MockSitting | null;
  payload: BlockPayload;
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

/**
 * One of the signed-in learner's mock exams, by the id of the session block that scheduled it: a
 * checkpoint block of an exam goal whose weekly Big Challenge is a mock. Another learner's block,
 * or a checkpoint that isn't a mock, is "not found".
 */
export async function findOwnedMock(blockId: string): Promise<OwnedMockResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const block = isUuid(blockId)
    ? await prisma.studySessionBlock.findFirst({
        include: {
          mockExam: { include: { answers: true } },
          session: { include: { goal: { include: { examBlueprint: true } } } },
        },
        where: { id: blockId, kind: "checkpoint", session: { userId } },
      })
    : null;

  const payload = block ? readBlockPayload(block) : null;

  if (!block || !payload?.checkpoint?.mock) {
    return { status: "notFound" };
  }

  const { mockExam, session: studySession, ...row } = block;
  const blueprint = studySession.goal?.examBlueprint ?? null;

  return {
    owned: {
      block: row,
      blueprint,
      goal: studySession.goal,
      mock: toSitting(mockExam),
      payload,
      sessionDate: studySession.localDate,
      structure: blueprint
        ? withClassTestMock({
            ownerId: blueprint.ownerId,
            structure: readBlueprintContent(blueprint).structure,
          })
        : null,
      userId,
    },
    status: "ready",
  };
}

const MS_PER_MINUTE = 60_000;

/** When the current section's time runs out. */
export function getSectionDeadline(mock: MockSitting): Date {
  const minutes = mock.conditions.sections[mock.sectionIndex]?.minutes ?? 0;
  return new Date(mock.sectionStartedAt.getTime() + minutes * MS_PER_MINUTE);
}
