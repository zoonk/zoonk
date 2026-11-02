import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { usesNonLatinScript } from "@zoonk/utils/languages";
import { CAPSULE_LEDGER_KIND } from "../../../milestones/award-milestones";
import { getAlphabetIdentityKey } from "./alphabet-identity";

const READS_SCRIPT_SCORE = 1;

export const ALPHABET_INTRO_DETAIL = "alphabetIntro";

type IntroGoal = Pick<Goal, "details" | "kind" | "language" | "targetLanguage">;

export type AlphabetIntro = {
  canDo: string | null;
  lessonId: string;
  minutes: number;
  pending: boolean;
  title: string;
};

function isSkipped(details: Goal["details"]): boolean {
  return isJsonObject(details) && details[ALPHABET_INTRO_DETAIL] === "skipped";
}

async function hasFinishedLesson({ lessonId, userId }: { lessonId: string; userId: string }) {
  const finished = await prisma.learningEvent.findFirst({
    select: { id: true },
    where: {
      OR: [{ lessonKind: null }, { lessonKind: { not: CAPSULE_LEDGER_KIND } }],
      contentIds: { equals: lessonId, path: ["lessonId"] },
      endedAt: { not: null },
      kind: { in: ["lesson", "review"] },
      userId,
    },
  });

  return finished !== null;
}

async function readsScript({ language, userId }: { language: string; userId: string }) {
  const reading = await prisma.languageSkillLevel.findUnique({
    select: { score: true },
    where: { userLanguageSkill: { language, skill: "reading", userId } },
  });

  return (reading?.score ?? 0) >= READS_SCRIPT_SCORE;
}

export async function loadAlphabetIntro({
  goal,
  userId,
}: {
  goal: IntroGoal;
  userId: string;
}): Promise<AlphabetIntro | null> {
  const target = goal.targetLanguage;

  if (goal.kind !== "language" || !target || !usesNonLatinScript(target)) {
    return null;
  }

  const lesson = await prisma.lesson.findUnique({
    select: { canDo: true, contentStatus: true, estimatedMinutes: true, id: true, title: true },
    where: {
      languageIdentity: { identityKey: getAlphabetIdentityKey(target), language: goal.language },
    },
  });

  if (!lesson || lesson.contentStatus !== "completed") {
    return null;
  }

  const [finished, reads] = await Promise.all([
    hasFinishedLesson({ lessonId: lesson.id, userId }),
    readsScript({ language: target, userId }),
  ]);

  return {
    canDo: lesson.canDo,
    lessonId: lesson.id,
    minutes: lesson.estimatedMinutes,
    pending: !finished && !reads && !isSkipped(goal.details),
    title: lesson.title,
  };
}
