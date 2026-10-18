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
import {
  type BlockPayload,
  readBlockPayload,
  toBlockPayload,
} from "../../../sessions/block-payload";
import { getSession } from "../../../users/get-session";
import { readExamChoices } from "../../choices/exam-choices";
import { isMockAnswerPresent } from "../mock-answer-presence";
import {
  MOCK_ABANDONMENT_DELAY_MS,
  type MockConditions,
  mockConditionsSchema,
} from "../mock-contract";
import { readMockAnswer } from "./mock-answers";
import { getAskedItemIds } from "./mock-sections";
import { readMockStructure } from "./read-mock-structure";

/**
 * Where a sitting stands: running (`active`), handed in and graded (`finished`), or `expired`, a
 * running one whose time ran out while the learner was away (see `hasTimeRunOutAway`).
 */
type MockSittingStatus = MockExam["status"] | "expired";

export type MockSitting = Omit<MockExam, "conditions" | "status"> & {
  answers: MockExamAnswer[];
  conditions: MockConditions;
  status: MockSittingStatus;
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
  const sitting = { ...mock, conditions: mockConditionsSchema.parse(mock.conditions) };

  return hasTimeRunOutAway({ mock: sitting, now: Date.now() })
    ? { ...sitting, status: "expired" }
    : sitting;
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
      session: {
        include: {
          goal: { include: { examBlueprint: true, plan: { select: { settings: true } } } },
        },
      },
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
    structure: blueprint
      ? readMockStructure({
          blueprint,
          choices: readExamChoices(studySession.goal?.plan?.settings),
        })
      : null,
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
    include: {
      answers: true,
      examBlueprint: true,
      goal: { include: { plan: { select: { settings: true } } } },
    },
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
    structure: examBlueprint
      ? readMockStructure({
          blueprint: examBlueprint,
          choices: readExamChoices(goal?.plan?.settings),
        })
      : null,
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

type SittingClock = Pick<MockSitting, "conditions" | "sectionIndex" | "sectionStartedAt">;

/** When the current section's time runs out. */
export function getSectionDeadline(mock: SittingClock): Date {
  const minutes = mock.conditions.sections[mock.sectionIndex]?.minutes ?? 0;
  return new Date(mock.sectionStartedAt.getTime() + minutes * MS_PER_MINUTE);
}

/** Under half of its questions answered, a score would mostly measure the time away. */
const MIN_ANSWERED_SHARE = 0.5;

/** A sitting as the rule reads it: its clock, and its drafts' answers. */
type SittingProgress = SittingClock & {
  answers: Pick<MockExamAnswer, "answer">[];
  status: MockSittingStatus;
};

/**
 * The running mock's time ran out while the learner was away, with most of it unanswered: the
 * clock of the section it's on (or of the next one, which starts on its own once a break ends) ran
 * out more than ten minutes before anything handed it in, and under half of its questions have an
 * answer. It was never sat, so it's never scored, recorded or counted toward preparation, and the
 * learner starts a new one. One mostly answered is graded as it stands, like a sitting the learner
 * left near the end. A placement mock is never abandoned: the learner stops it whenever they come
 * back, and what they answered sets where the plan starts. A mock whose sections were all handed in
 * only waits to be graded.
 */
function hasTimeRunOutAway({ mock, now }: { mock: SittingProgress; now: number }): boolean {
  const { purpose, sections } = mock.conditions;
  const questions = sections.reduce((sum, section) => sum + section.questions, 0);
  const essays = sections.reduce((sum, section) => sum + section.essays.length, 0);

  const answered = mock.answers.filter((draft) =>
    isMockAnswerPresent(readMockAnswer(draft.answer)),
  ).length;

  return (
    mock.status === "active" &&
    purpose !== "placement" &&
    mock.sectionIndex < sections.length &&
    now >= getSectionDeadline(mock).getTime() + MOCK_ABANDONMENT_DELAY_MS &&
    answered < (questions + essays) * MIN_ANSWERED_SHARE
  );
}

/** The same rule on a stored sitting read on its own, its conditions as stored. */
export function hasStoredTimeRunOutAway({
  mock,
  now,
}: {
  mock: Omit<SittingProgress, "conditions"> & Pick<MockExam, "conditions">;
  now: number;
}): boolean {
  const conditions = mockConditionsSchema.safeParse(mock.conditions).data;
  return conditions !== undefined && hasTimeRunOutAway({ mock: { ...mock, conditions }, now });
}
