import "server-only";
import { type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { startStudyBlock } from "../../sessions/start-study-block";
import { admitWriting } from "../essays/writing-admission";
import { type WritingNeedsChoice } from "../essays/writing-contract";
import { getAnytimeMockAccess } from "./_utils/anytime-mock-access";
import { buildMockConditions } from "./_utils/mock-conditions";
import { getMockWritingAvailability } from "./_utils/mock-writing-choices";
import { findMockWriting } from "./_utils/mock-writing-supply";
import { type OwnedMock, findOwnedMock } from "./_utils/owned-mock";
import { type MockConditions, type MockTimeZoneInput } from "./mock-contract";
import { snapshotMockWriting } from "./mock-written-points";
import { bindMockWriting } from "./written-test-plan";

type StartWritingRequest = {
  count: number;
  goalId: string;
  taskKey: string;
  unit: "answer";
  userId: string;
};

export type StartMockResult =
  | WritingNeedsChoice
  | {
      status:
        | "blockFinished"
        | "expired"
        | "finished"
        | "notEnoughQuestions"
        | "notFound"
        | "plusRequired"
        | "ready"
        | "signUpRequired"
        | "unauthorized";
    }
  | { requests: StartWritingRequest[]; status: "writing" };

async function startScheduledBlock({
  block,
  input,
}: {
  block: Pick<StudySessionBlock, "id" | "sessionId">;
  input: MockTimeZoneInput;
}): Promise<StartMockResult> {
  const started = await startStudyBlock({ blockId: block.id, input, sessionId: block.sessionId });

  if (
    started.status === "questionsNeeded" ||
    started.status === "earlierFirst" ||
    started.status === "plusRequired"
  ) {
    throw new Error(`Mock block ${block.id} was refused as a phase challenge: ${started.status}.`);
  }

  return { status: started.status };
}

export async function startMock({
  blockId,
  input,
}: {
  blockId: string;
  input: MockTimeZoneInput;
}): Promise<StartMockResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { owned } = found;

  if (owned.mock?.status === "expired" && owned.block) {
    const { block, mock } = owned;

    await writeLearnerChange({ userId: owned.userId }, async (tx) => {
      const { count } = await tx.mockExam.updateMany({
        data: { blockId: null },
        where: { blockId: block.id, id: mock.id },
      });

      return count > 0 ? count : unchanged(count);
    });
  } else if (owned.mock) {
    if (owned.mock.status === "active" && owned.block) {
      return startScheduledBlock({ block: owned.block, input });
    }

    return { status: owned.mock.status === "active" ? "ready" : owned.mock.status };
  }

  if (!owned.block) {
    return { status: "notFound" };
  }

  return startNewScheduledMock({ input, owned: { ...owned, block: owned.block } });
}

async function startNewScheduledMock({
  input,
  owned,
}: {
  input: MockTimeZoneInput;
  owned: OwnedMock & { block: StudySessionBlock };
}): Promise<StartMockResult> {
  const { block, goal, payload, structure, userId } = owned;

  if (goal && (await getAnytimeMockAccess(goal)) !== "open") {
    return { status: "plusRequired" };
  }

  if (block.status === "completed" || block.status === "skipped") {
    return { status: "blockFinished" };
  }

  const identity = payload.checkpoint?.mockIdentity;
  const fullKind = identity?.fullLength ? "full" : "half";
  const kind = payload.checkpoint?.written ? "written" : fullKind;
  const shape = { day: identity?.day ?? null, kind } as const;
  const { blueprint, picks } = owned;

  const availability = getMockWritingAvailability({
    picks,
    shape,
    structure: blueprint ? readBlueprintContent(blueprint).structure : null,
  });

  if (availability) {
    return availability;
  }

  const writingInput = goal ? { goal, goalId: goal.id, shape, structure, userId } : null;
  const supply = writingInput && (await findMockWriting(writingInput));

  if (supply?.status === "missing" && goal) {
    return {
      requests: supply.requests.map((request) => ({ ...request, goalId: goal.id, userId })),
      status: "writing",
    };
  }

  const started = await startScheduledBlock({ block, input });

  if (started.status !== "ready") {
    return started;
  }

  const preview = await buildMockConditions(owned);

  return writeLearnerChange<StartMockResult>({ userId }, (tx) =>
    persistScheduledMock({ input, owned, preview, tx, writingInput }),
  );
}

async function persistScheduledMock({
  input,
  owned,
  preview,
  tx,
  writingInput,
}: {
  input: MockTimeZoneInput;
  owned: OwnedMock & { block: StudySessionBlock };
  preview: MockConditions;
  tx: TransactionClient;
  writingInput: Parameters<typeof findMockWriting>[0] | null;
}) {
  const {
    block: { id: blockId },
    goal,
    userId,
  } = owned;

  const existing = await tx.mockExam.findUnique({ where: { blockId } });

  if (existing) {
    return unchanged({ status: "ready" });
  }

  if (writingInput && writingInput.shape.kind !== "half") {
    await lockUsageForViewer({ transaction: tx, userId });
  }

  const writing = writingInput && (await findMockWriting({ ...writingInput, tx }));

  if (writing?.status === "missing" && goal) {
    return unchanged({
      requests: writing.requests.map((request) => ({ ...request, goalId: goal.id, userId })),
      status: "writing",
    });
  }

  const essays = writing?.status === "ready" ? writing.essays : [];

  const sections = bindMockWriting({
    day: preview.day,
    essays,
    sections: preview.sections,
    structure: owned.structure,
  });

  if (!sections?.length) {
    return unchanged({ status: "notEnoughQuestions" });
  }

  const conditions = {
    ...preview,
    sections,
    ...snapshotMockWriting({ day: preview.day, essays, structure: owned.structure }),
  };

  const now = new Date();

  const created = await tx.mockExam.create({
    data: {
      blockId,
      conditions,
      examBlueprintId: owned.blueprint?.id ?? null,
      goalId: goal?.id ?? null,
      sectionStartedAt: now,
      startedAt: now,
      userId,
    },
  });

  if (essays.length > 0) {
    const admitted = await admitWriting({
      extra: false,
      itemIds: essays.map((essay) => essay.itemId),
      localDate: getDateInTimeZone({
        date: now,
        timeZone: getAnswerTimeZone({ goal, timeZone: input.timeZone }),
      }),
      owner: { mock: created },
      tx,
      userId,
    });

    if (admitted.status !== "ready") {
      return unchanged({ status: "signUpRequired" as const });
    }
  }

  return { status: "ready" as const };
}
