import "server-only";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { isStillAsked } from "../../library/items/item-image";
import { routeNextModule } from "../scoring/adaptive-routing";
import { endMock } from "./_utils/end-mock";
import { readMockAnswer } from "./_utils/mock-answers";
import { gradeMockItem } from "./_utils/mock-item-grading";
import { loadMockItems } from "./_utils/mock-items";
import { type MockSitting, findOwnedMock, getSectionDeadline } from "./_utils/owned-mock";
import { isMockAnswerPresent } from "./mock-answer-presence";
import { type MockConditions, type MockTimeZoneInput } from "./mock-contract";

export type SubmitMockSectionResult = {
  status: "expired" | "finished" | "next" | "notFound" | "notRunning" | "unauthorized";
};

async function scoreModule({ itemIds, mock }: { itemIds: readonly string[]; mock: MockSitting }) {
  const items = await loadMockItems(itemIds);

  const verdicts = itemIds.flatMap((itemId) => {
    const item = items.get(itemId);
    const answer = readMockAnswer(mock.answers.find((draft) => draft.itemId === itemId)?.answer);

    if (!item) {
      return [false];
    }

    if (!isStillAsked({ answered: isMockAnswerPresent(answer), item })) {
      return [];
    }

    return [
      gradeMockItem({ answer, item, mockId: mock.id, partialCredit: mock.conditions.partialCredit })
        .isCorrect,
    ];
  });

  return { correct: verdicts.filter(Boolean).length, total: verdicts.length };
}

async function advanceConditions({
  mock,
  section,
  timedOut,
}: {
  mock: MockSitting;
  section: number;
  timedOut: boolean;
}): Promise<MockConditions> {
  const { conditions } = mock;
  const current = conditions.sections[section];
  const next = conditions.sections[section + 1];

  const timedOutSections = timedOut
    ? [...conditions.timedOutSections, section]
    : conditions.timedOutSections;

  if (!current || !next?.routing || next.itemIds.length > 0) {
    return { ...conditions, timedOutSections };
  }

  const itemIds = routeNextModule({
    ...(await scoreModule({ itemIds: current.itemIds, mock })),
    questions: next.questions,
    routing: next.routing,
  });

  return {
    ...conditions,
    sections: conditions.sections.map((item, index) =>
      index === section + 1 ? { ...item, itemIds } : item,
    ),
    timedOutSections,
  };
}

const MS_PER_MINUTE = 60_000;

export async function submitMockSection({
  blockId,
  input,
  section,
}: {
  blockId: string;
  input: MockTimeZoneInput;
  section: number;
}): Promise<SubmitMockSectionResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { owned } = found;
  const { mock } = owned;

  if (mock?.status === "expired") {
    return { status: "expired" };
  }

  if (mock?.status !== "active" || mock.sectionIndex !== section) {
    return { status: mock?.status === "finished" ? "finished" : "notRunning" };
  }

  const now = new Date();
  const timedOut = now.getTime() >= getSectionDeadline(mock).getTime();
  const conditions = await advanceConditions({ mock, section, timedOut });
  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  if (section >= mock.conditions.sections.length - 1) {
    return { status: await endMock({ conditions, mock, owned, timeZone }) };
  }

  const breakMs = (mock.conditions.sections[section]?.breakAfterMinutes ?? 0) * MS_PER_MINUTE;

  const count = await writeLearnerChange({ userId: owned.userId }, async (tx) => {
    const updated = await tx.mockExam.updateMany({
      data: {
        conditions,
        sectionIndex: section + 1,
        sectionStartedAt: new Date(now.getTime() + breakMs),
      },
      where: { id: mock.id, sectionIndex: section, status: "active" },
    });

    return updated.count > 0 ? updated.count : unchanged(updated.count);
  });

  return { status: count === 0 ? "notRunning" : "next" };
}
