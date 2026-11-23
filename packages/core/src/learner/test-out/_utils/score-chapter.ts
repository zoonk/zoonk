import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAskedItemFilter } from "../../../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { loadSkillConfirmations } from "../../_utils/load-skill-claims";
import { loadSeenPlacementItems } from "../../placement/_utils/placement-evidence";
import {
  type PlacementItem,
  gradePlacementAnswer,
  parsePlacementItem,
} from "../../placement/_utils/placement-items";
import { persistLearnerAnswer } from "../../record-learner-answer";
import { type ChapterTestOutInput } from "../test-out-contract";
import { pickTestOutSkills, scoreTestOut } from "../test-out-rules";
import { type getChapterSkills } from "./chapter-items";

type TestOutAnswer = ChapterTestOutInput["answers"][number];

type GradedAnswer = { answer: TestOutAnswer; item: PlacementItem } & ReturnType<
  typeof gradePlacementAnswer
>;

function firstAnswerPerItem(answers: readonly TestOutAnswer[]): TestOutAnswer[] {
  return answers.filter(
    (answer, index) => answers.findIndex((other) => other.itemId === answer.itemId) === index,
  );
}

async function gradeAnswers({
  answers,
  examBlueprintId,
  sampled,
  tx,
}: {
  answers: readonly TestOutAnswer[];
  examBlueprintId: string | null;
  sampled: readonly string[];
  tx: TransactionClient;
}): Promise<GradedAnswer[] | null> {
  const rows = await tx.item.findMany({
    include: ITEM_IMAGE_INCLUDE,
    where: {
      id: { in: answers.map((answer) => answer.itemId) },
      skillId: { in: [...sampled] },
      ...getAskedItemFilter({ examBlueprintId }),
    },
  });

  const graded = answers.map((answer) => {
    const row = rows.find((candidate) => candidate.id === answer.itemId);
    const item = row ? parsePlacementItem(row) : null;

    return item ? { answer, ...gradePlacementAnswer({ answer: answer.answer, item }), item } : null;
  });

  return graded.every((entry) => entry !== null) ? graded : null;
}

async function recordAnswers({
  answeredAt,
  graded,
  timeZone,
  tx,
  userId,
}: {
  answeredAt: Date;
  graded: readonly GradedAnswer[];
  timeZone: string;
  tx: TransactionClient;
  userId: string;
}) {
  const events = [];

  for (const { answer, isCorrect, item, snapshot } of graded) {
    // oxlint-disable-next-line no-await-in-loop -- Each answer reads memory updated by the previous one.
    const recorded = await persistLearnerAnswer({
      input: {
        answer: answer.answer,
        answeredAt,
        graded: { durationMs: answer.durationMs, isCorrect },
        itemId: item.id,
        language: item.language,
        mistake: { questionText: snapshot.question, snapshot },
        purpose: "diagnostic",
        skillId: item.skillId,
        timeZone,
        userId,
      },
      transaction: tx,
    });

    events.push(...recorded.events);
  }

  return events;
}

export async function scoreChapter({
  answeredAt,
  chapterSkills,
  goal,
  input,
  timeZone,
  tx,
  userId,
}: {
  answeredAt: Date;
  chapterSkills: ReturnType<typeof getChapterSkills>;
  goal: Goal;
  input: ChapterTestOutInput;
  timeZone: string;
  tx: TransactionClient;
  userId: string;
}) {
  const goalId = goal.id;
  const sampled = pickTestOutSkills(chapterSkills).map((skill) => skill.id);

  const submitted = firstAnswerPerItem(input.answers);

  const graded = await gradeAnswers({
    answers: submitted,
    examBlueprintId: goal.examBlueprintId,
    sampled,
    tx,
  });

  if (!graded) {
    return null;
  }

  const localDate = getDateInTimeZone({ date: answeredAt, timeZone });

  const seen = await loadSeenPlacementItems({
    itemIds: submitted.map((answer) => answer.itemId),
    tx,
    userId,
  });

  const fresh = graded.filter(({ item }) => !seen.has(item.id));

  const events = await recordAnswers({ answeredAt, graded: fresh, timeZone, tx, userId });

  const score = scoreTestOut({
    chapterSkillIds: chapterSkills.map((skill) => skill.id),
    results: fresh.map(({ isCorrect, item }) => ({
      content: item.content,
      format: item.format,
      isCorrect,
      itemId: item.id,
      localDate,
      skillId: item.skillId,
    })),
  });

  const { confirmed: knownSkillIds } = await loadSkillConfirmations({
    goalId,
    skillIds: score.knownSkillIds,
    timeZone,
    tx,
    userId,
  });

  return { events, graded: fresh, knownSkillIds, score };
}
