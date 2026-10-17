import "server-only";
import { prisma } from "@zoonk/db";
import { isCefrLevel } from "@zoonk/utils/cefr";
import { findCheckpointUnit } from "../../language/conversations/_utils/checkpoint-block";
import { getSpeakingLevel } from "../../language/conversations/_utils/conversation-goal";
import { findUnitScenario } from "../../language/conversations/_utils/conversation-scenario";
import {
  type ConversationScenario,
  conversationScenarioSchema,
} from "../../language/conversations/conversation-contract";
import { getCheckpointMinutes } from "../../language/conversations/conversation-rules";
import { type ChallengeCall } from "../challenge-contract";
import { type OwnedChallenge, isLanguageCall } from "./owned-challenge";

function toGoals(scenario: ConversationScenario | null): ChallengeCall["goals"] {
  return scenario?.objectives.map(({ description, label }) => ({ description, label })) ?? null;
}

/**
 * The call the intro's block already opened, as it was opened: Continue reopens that call, at the
 * level and with the goals it was written with, whatever the learner's level is now.
 */
async function findOpenedCall(blockId: string | null): Promise<ChallengeCall | null> {
  const opened = blockId
    ? await prisma.languageConversation.findUnique({
        select: {
          level: true,
          minutes: true,
          scenario: true,
          targetLanguage: true,
          titleSnapshot: true,
        },
        where: { studyBlockId: blockId },
      })
    : null;

  if (!opened || !isCefrLevel(opened.level)) {
    return null;
  }

  const scenario = conversationScenarioSchema.safeParse(opened.scenario);

  return {
    goals: toGoals(scenario.success ? scenario.data : null),
    level: opened.level,
    minutes: opened.minutes,
    targetLanguage: opened.targetLanguage,
    title: opened.titleSnapshot,
  };
}

/**
 * A language goal's phase checkpoint as the unit's call it is. Once its block (`blockId`, the one
 * the intro opens) opened a call, that call. Before, its talk time at the level the learner speaks
 * at now (the call opens at that level), and, once the unit's call is written at that level (ahead
 * of its day, `prepareCheckpointCall`), its name and the goals to get across. Reading it never
 * writes the call. Null for any other challenge.
 */
export async function loadChallengeCall({
  blockId,
  challenge,
}: {
  blockId: string | null;
  challenge: OwnedChallenge;
}): Promise<ChallengeCall | null> {
  const { goal, item, userId } = challenge;
  const { targetLanguage } = goal;

  if (!isLanguageCall(challenge) || !targetLanguage) {
    return null;
  }

  const opened = await findOpenedCall(blockId);

  if (opened) {
    return opened;
  }

  const [unit, level] = await Promise.all([
    findCheckpointUnit({ goal, planItemId: item.id }),
    getSpeakingLevel({ goal, targetLanguage, userId }),
  ]);

  const scenario = unit ? await findUnitScenario({ chapterId: unit.chapterId, level }) : null;

  return {
    goals: toGoals(scenario),
    level,
    minutes: getCheckpointMinutes(level),
    targetLanguage,
    title: scenario?.title ?? null,
  };
}
