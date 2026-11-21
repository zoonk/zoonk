import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { loadConfirmedSkills } from "../../_utils/load-skill-claims";
import {
  type PlacementItem,
  gradePlacementAnswer,
  parsePlacementItem,
} from "../../placement/_utils/placement-items";
import { recordLearnerAnswer } from "../../record-learner-answer";
import { type ChapterTestOutInput } from "../test-out-contract";
import { pickTestOutSkills, scoreTestOut } from "../test-out-rules";
import { type getChapterSkills, loadSkillItems } from "./chapter-items";

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
  chapterSkillIds,
}: {
  answers: readonly TestOutAnswer[];
  chapterSkillIds: readonly string[];
}): Promise<GradedAnswer[] | null> {
  const rows = await prisma.item.findMany({
    include: ITEM_IMAGE_INCLUDE,
    where: { id: { in: answers.map((answer) => answer.itemId) } },
  });

  const graded = answers.map((answer) => {
    const row = rows.find((candidate) => candidate.id === answer.itemId);
    const item = row && chapterSkillIds.includes(row.skillId) ? parsePlacementItem(row) : null;

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

  const items = await loadSkillItems({
    examBlueprintId: goal.examBlueprintId,
    skillIds: sampled,
    userId,
  });

  const available = new Set(items.map((item) => item.id));
  const submitted = firstAnswerPerItem(input.answers);

  if (submitted.some((answer) => !available.has(answer.itemId))) {
    return null;
  }

  const graded = await gradeAnswers({ answers: submitted, chapterSkillIds: sampled });

  if (!graded) {
    return null;
  }

  const localDate = getDateInTimeZone({ date: answeredAt, timeZone });
  const seen = new Set(items.filter((item) => item.seen).map((item) => item.id));
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

  const knownSkillIds = await loadConfirmedSkills({
    goalId,
    skillIds: score.knownSkillIds,
    timeZone,
    userId,
  });

  return { graded: fresh, knownSkillIds, score };
}
