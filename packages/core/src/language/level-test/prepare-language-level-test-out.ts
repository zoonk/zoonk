import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import {
  LEVEL_TEST_OUT_LISTENING_FORMATS,
  toListeningItem,
} from "@zoonk/ai/tasks/listening/schema";
import { writeListeningSet } from "@zoonk/ai/tasks/listening/write-set";
import { type Skill, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { LOW_GUESS_ANSWERS_TO_SKIP } from "../../learner/_utils/placement-guess-rate";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { toListeningContent } from "../../library/listening/listening-content";
import { listTestOutSkillIds, readTestOutBank } from "./_utils/level-test-out-items";
import { saveTestOut } from "./_utils/level-test-out-state";
import { type LevelTestOutLevel, isPreparingLevelTestOut } from "./level-test-out-contract";
import { readLevelTestAttempts } from "./read-level-test-summary";

const QUESTIONS = 1 + LOW_GUESS_ANSWERS_TO_SKIP;

type ListeningTopic = Pick<Skill, "description" | "id" | "name">;

export type LevelTestOutPreparationInput = { attemptId: string; goalId: string; userId: string };

/** Internal workflow bridge. A preparation must still belong to the learner's open attempt. */
export async function readLevelTestOutPreparation({
  attemptId,
  goalId,
  userId,
}: LevelTestOutPreparationInput) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId, kind: "language", userId } });
  const { testOut } = goal ? readLevelTestAttempts(goal) : {};

  if (!goal?.targetLanguage || testOut?.id !== attemptId || !isPreparingLevelTestOut(testOut)) {
    return null;
  }

  const skillIds = await listTestOutSkillIds({
    goalId,
    level: testOut.level,
    timeZone: getAnswerTimeZone({ goal }),
    tx: prisma,
    userId,
  });

  const [bank, sharedTopics] = await Promise.all([
    readTestOutBank({ skillIds, tx: prisma, userId }),
    prisma.skill.findMany({
      select: { description: true, id: true, name: true },
      where: { id: { in: skillIds }, ownerId: null, visibility: "public" },
    }),
  ]);

  const topics = new Map(sharedTopics.map((topic) => [topic.id, topic]));

  return {
    ...bank,
    language: goal.language,
    level: testOut.level,
    scriptLanguage: goal.targetLanguage,
    skillIds,
    topic: skillIds.flatMap((id) => topics.get(id) ?? [])[0] ?? null,
  };
}

export async function writeLevelTestOutListeningSet({
  analytics,
  language,
  level,
  scriptLanguage,
  serviceTier,
  topic,
}: {
  analytics: AiGenerationContext;
  language: string;
  level: LevelTestOutLevel;
  scriptLanguage: string;
  serviceTier?: ServiceTier;
  topic: ListeningTopic;
}) {
  const plays = 2;
  const task = "A three-minute recording that puts the topic in an everyday situation.";

  const written = await writeListeningSet({
    accents: [],
    analytics,
    count: QUESTIONS,
    exam: null,
    formats: LEVEL_TEST_OUT_LISTENING_FORMATS,
    language,
    level,
    plays,
    scriptLanguage,
    serviceTier,
    skills: [topic],
    task,
  });

  const { problems, set } = written.data;

  if (problems.length > 0) {
    throw new Error(problems.join(" "));
  }

  return {
    content: toListeningContent({ plays, scriptLanguage, set, task: null }),
    items: set.questions.map((question) => ({
      format: question.format,
      item: toListeningItem(question),
      skillId: topic.id,
    })),
    kind: "audio" as const,
    language,
    minItems: QUESTIONS,
    optionLanguage: scriptLanguage,
    provenance: written.provenance,
  };
}

export async function finishLevelTestOutPreparation({
  attemptId,
  goalId,
  userId,
}: LevelTestOutPreparationInput) {
  const updated = await writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId },
    async (tx) => {
      const goal = await tx.goal.findUnique({ where: { id: goalId, kind: "language", userId } });
      const { testOut } = goal ? readLevelTestAttempts(goal) : {};

      if (!goal || testOut?.id !== attemptId || !isPreparingLevelTestOut(testOut)) {
        return unchanged(false);
      }

      const skillIds = await listTestOutSkillIds({
        goalId,
        level: testOut.level,
        timeZone: getAnswerTimeZone({ goal }),
        tx,
        userId,
      });

      const { questions } = await readTestOutBank({ skillIds, tx, userId });

      await saveTestOut({
        goal,
        progress: { id: testOut.id, level: testOut.level, questions },
        tx,
      });

      return true;
    },
  );

  if (updated) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
  }
}
