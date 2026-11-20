import "server-only";
import { isStillAsked } from "../../../library/items/item-image";
import { writingPromptSchema } from "../../essays/writing-contract";
import { isMockAnswerPresent } from "../mock-answer-presence";
import { type MockView } from "../mock-contract";
import { type MockQuestion } from "../mock-view-contract";
import { readMockAnswer } from "./mock-answers";
import { loadMockEssayItems, readMockWriting } from "./mock-essays";
import { loadMockItems, toMockQuestionView } from "./mock-items";
import { getSectionPlace } from "./mock-navigation";
import { listSectionPlays } from "./mock-plays";
import { getFirstNumber } from "./mock-sections";
import { type MockSitting, getSectionDeadline } from "./owned-mock";

export async function loadCurrentSection({
  areas,
  mock,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
}): Promise<MockView["current"]> {
  const section = mock.conditions.sections[mock.sectionIndex];

  if (!section) {
    return null;
  }

  const [items, essays] = await Promise.all([
    loadMockItems(section.itemIds),
    loadMockEssayItems(section.essays),
  ]);

  const first = getFirstNumber({ conditions: mock.conditions, section: mock.sectionIndex });

  const answered = new Set(
    mock.answers.flatMap((answer) =>
      isMockAnswerPresent(readMockAnswer(answer.answer)) ? [answer.itemId] : [],
    ),
  );

  const questions = section.itemIds.flatMap((itemId, index): MockQuestion[] => {
    const item = items.get(itemId);

    return item && isStillAsked({ answered: answered.has(itemId), item })
      ? [
          {
            ...toMockQuestionView({ item, mockId: mock.id }),
            area: areas.get(item.skillId) ?? null,
            number: first + index,
          },
        ]
      : [];
  });

  const written = section.essays.flatMap((itemId, index): MockQuestion[] => {
    const essay = essays.get(itemId);
    const writing = essay ? writingPromptSchema.safeParse(readMockWriting(essay.item)).data : null;

    return essay
      ? [
          {
            area: areas.get(essay.item.skillId) ?? null,
            context: essay.content.context,
            entry: null,
            format: "essay",
            image: null,
            itemId,
            number: first + section.questions + index,
            ...(writing && { writing }),
            options: null,
            question: essay.content.question,
            select: null,
            set: null,
            skillId: essay.item.skillId,
            unit: null,
            visual: null,
          },
        ]
      : [];
  });

  const asked = new Set([...section.itemIds, ...section.essays]);
  const shownIds = [...questions, ...written].map((question) => question.itemId);
  const rows = mock.answers.filter((answer) => asked.has(answer.itemId));

  const drafts = rows.map((answer) => ({
    answer: readMockAnswer(answer.answer),
    durationMs: answer.durationMs,
    flagged: answer.flagged,
    itemId: answer.itemId,
  }));

  return {
    ...getSectionPlace({ itemIds: shownIds, navigation: section.navigation, rows }),
    deadline: getSectionDeadline(mock).toISOString(),
    drafts,
    kind: section.kind ?? null,
    plays: listSectionPlays({ plays: mock.listeningPlays, questions }),
    questions: [...questions, ...written],
    section: mock.sectionIndex,
  };
}
