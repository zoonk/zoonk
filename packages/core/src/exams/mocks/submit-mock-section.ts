import "server-only";
import { prisma } from "@zoonk/db";
import { gradeChoiceAnswer } from "../../learner/_utils/choice-items";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { routeNextModule } from "../scoring/adaptive-routing";
import { endMock } from "./_utils/end-mock";
import { loadMockItems } from "./_utils/mock-items";
import { type MockSitting, findOwnedMock, getSectionDeadline } from "./_utils/owned-mock";
import { type MockConditions, type MockTimeZoneInput, readMockChoice } from "./mock-contract";

export type SubmitMockSectionResult = {
  status: "finished" | "next" | "notFound" | "notRunning" | "unauthorized";
};

/** How the submitted module went, graded in memory: the drafts stay drafts until the end. */
async function countRight({ itemIds, mock }: { itemIds: readonly string[]; mock: MockSitting }) {
  const items = await loadMockItems(itemIds);

  return itemIds.filter((itemId) => {
    const item = items.get(itemId);
    const choice = readMockChoice(mock.answers.find((answer) => answer.itemId === itemId)?.answer);
    return item && choice ? gradeChoiceAnswer({ answer: choice, item }).isCorrect : false;
  }).length;
}

/** The conditions once a section is submitted: the time-out noted and the next module routed. */
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
    correct: await countRight({ itemIds: current.itemIds, mock }),
    questions: next.questions,
    routing: next.routing,
    total: current.itemIds.length,
  });

  return {
    ...conditions,
    sections: conditions.sections.map((item, index) =>
      index === section + 1 ? { ...item, itemIds } : item,
    ),
    timedOutSections,
  };
}

/**
 * Hands in the running section, by the learner or when its time runs out: the next section's
 * clock starts (an adaptive exam's next module is picked here), and handing in the last one ends
 * the mock. A section handed in twice, from two tabs, moves the mock on once.
 */
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

  const { count } = await prisma.mockExam.updateMany({
    data: { conditions, sectionIndex: section + 1, sectionStartedAt: now },
    where: { id: mock.id, sectionIndex: section, status: "active" },
  });

  return { status: count === 0 ? "notRunning" : "next" };
}
