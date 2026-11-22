import "server-only";
import { type Goal, prisma } from "@zoonk/db";
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
import { recordLearnerAnswer } from "../../record-learner-answer";
import { type ChapterTestOutInput } from "../test-out-contract";
import { pickTestOutSkills, scoreTestOut } from "../test-out-rules";
import { type getChapterSkills } from "./chapter-items";

type TestOutAnswer = ChapterTestOutInput["answers"][number];

export type GradedAnswer = { answer: TestOutAnswer; item: PlacementItem } & ReturnType<
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
}: {
  answers: readonly TestOutAnswer[];
  examBlueprintId: string | null;
  sampled: readonly string[];
}): Promise<GradedAnswer[] | null> {
  const rows = await prisma.item.findMany({
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

/** Record answers on the same skill sequentially so their memory updates cannot race. */
async function recordAnswers({
  answeredAt,
  graded,
  timeZone,
  userId,
}: {
  answeredAt: Date;
  graded: readonly GradedAnswer[];
  timeZone: string;
  userId: string;
}): Promise<void> {
  const record = ({ answer, isCorrect, item, snapshot }: GradedAnswer) =>
    recordLearnerAnswer({
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
    });

  await Promise.all(
    [...Map.groupBy(graded, (entry) => entry.item.skillId).values()].map((answers) =>
      answers.reduce<Promise<unknown>>(
        (previous, entry) => previous.then(() => record(entry)),
        Promise.resolve(),
      ),
    ),
  );
}

export async function scoreChapter({
  answeredAt,
  chapterSkills,
  goal,
  input,
  timeZone,
  userId,
}: {
  answeredAt: Date;
  chapterSkills: ReturnType<typeof getChapterSkills>;
  goal: Goal;
  input: ChapterTestOutInput;
  timeZone: string;
  userId: string;
}) {
  const goalId = goal.id;
  const sampled = pickTestOutSkills(chapterSkills).map((skill) => skill.id);

  const submitted = firstAnswerPerItem(input.answers);

  const [graded, seen] = await Promise.all([
    gradeAnswers({ answers: submitted, examBlueprintId: goal.examBlueprintId, sampled }),
    loadSeenPlacementItems({ itemIds: submitted.map((answer) => answer.itemId), userId }),
  ]);

  if (!graded) {
    return null;
  }

  const localDate = getDateInTimeZone({ date: answeredAt, timeZone });
  const fresh = graded.filter(({ item }) => !seen.has(item.id));

  await recordAnswers({ answeredAt, graded: fresh, timeZone, userId });

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
    userId,
  });

  return { graded: fresh, knownSkillIds, score };
}
