import "server-only";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { isStillAsked } from "../../library/items/item-image";
import { routeNextModule } from "../scoring/adaptive-routing";
import { endMock, withSectionTimeout } from "./_utils/end-mock";
import { readMockAnswer } from "./_utils/mock-answers";
import { gradeMockItem } from "./_utils/mock-item-grading";
import { type MockItem, loadMockItems } from "./_utils/mock-items";
import { type MockSitting, findMockSitting, findOwnedMock } from "./_utils/owned-mock";
import { isMockAnswerPresent } from "./mock-answer-presence";
import { type MockConditions, type MockTimeZoneInput } from "./mock-contract";

export type SubmitMockSectionResult = {
  status: "expired" | "finished" | "next" | "notFound" | "notRunning" | "unauthorized";
};

function scoreModule({
  itemIds,
  items,
  mock,
}: {
  itemIds: readonly string[];
  items: Map<string, MockItem>;
  mock: MockSitting;
}) {
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

function findRoutedModule({ conditions, sectionIndex }: MockSitting) {
  const current = conditions.sections[sectionIndex];
  const next = conditions.sections[sectionIndex + 1];

  return current && next?.routing && next.itemIds.length === 0
    ? { itemIds: current.itemIds, questions: next.questions, routing: next.routing }
    : null;
}

function advanceConditions({
  items,
  mock,
  now,
}: {
  items: Map<string, MockItem>;
  mock: MockSitting;
  now: Date;
}): MockConditions {
  const conditions = withSectionTimeout({ mock, now });
  const routed = findRoutedModule(mock);

  if (!routed) {
    return conditions;
  }

  const itemIds = routeNextModule({
    ...scoreModule({ itemIds: routed.itemIds, items, mock }),
    questions: routed.questions,
    routing: routed.routing,
  });

  return {
    ...conditions,
    sections: conditions.sections.map((item, index) =>
      index === mock.sectionIndex + 1 ? { ...item, itemIds } : item,
    ),
  };
}

const MS_PER_MINUTE = 60_000;

/** Scores and moves the section from the sitting read under the learner's lock, which saves take too. */
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

  if (section >= mock.conditions.sections.length - 1) {
    const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });
    return { status: await endMock({ mock, owned, timeZone }) };
  }

  const routed = findRoutedModule(mock);
  const items = routed ? await loadMockItems(routed.itemIds) : new Map<string, MockItem>();

  const moved = await writeLearnerChange({ userId: owned.userId }, async (tx) => {
    const current = await findMockSitting(tx, mock.id);

    if (current?.status !== "active" || current.sectionIndex !== section) {
      return unchanged(false);
    }

    const now = new Date();
    const breakMs = (current.conditions.sections[section]?.breakAfterMinutes ?? 0) * MS_PER_MINUTE;

    await tx.mockExam.update({
      data: {
        conditions: advanceConditions({ items, mock: current, now }),
        sectionIndex: section + 1,
        sectionStartedAt: new Date(now.getTime() + breakMs),
      },
      where: { id: mock.id },
    });

    return true;
  });

  return { status: moved ? "next" : "notRunning" };
}
