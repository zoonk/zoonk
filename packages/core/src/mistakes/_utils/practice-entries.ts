import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getMistakeSkillIds, loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { type MistakePracticeFinishInput } from "../contract";
import { listReadyMistakes } from "../mistake-availability";
import { loadMistakeReplays } from "../mistake-replay";
import { narrowToSkill } from "./mistake-scope";
import { mockMistakeWhere } from "./mock-practice";
import { openVisibleMistakeWhere } from "./visible-mistake";

export async function loadPracticeEntries({
  includeAllFormats,
  mockId,
  skillIds,
  userId,
}: {
  includeAllFormats?: boolean;
  mockId?: string;
  skillIds: string[] | null;
  userId: string;
}) {
  const mistakes = await prisma.mistake.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: {
      ...openVisibleMistakeWhere,
      ...(mockId && (await mockMistakeWhere({ mockId, userId }))),
      ...(skillIds && { skillId: { in: skillIds } }),
      userId,
    },
  });

  const replays = await loadMistakeReplays({ mistakes, userId });

  return mistakes.flatMap((mistake) => {
    const replay = replays.get(mistake.id);

    const standard =
      replay?.kind === "item" && ["multipleChoice", "trueFalse"].includes(replay.item.format);

    return replay && (mockId || includeAllFormats || standard) ? [{ ...mistake, replay }] : [];
  });
}

export async function hasPracticeRemaining({
  goal,
  input,
  timeZone,
  userId,
}: {
  goal: Goal | null;
  input: MistakePracticeFinishInput;
  timeZone: string;
  userId: string;
}): Promise<boolean> {
  const { blockId, ended, includeAllFormats, mockId, skillId } = input;

  if (!ended || blockId) {
    return false;
  }

  const plan = goal && !mockId ? await loadGoalPlan(goal.id) : null;

  const skillIds = narrowToSkill({
    scopeSkillIds: plan && getMistakeSkillIds(plan.skills),
    skillId,
  });

  const entries = await loadPracticeEntries({ includeAllFormats, mockId, skillIds, userId });
  const localDate = getDateInTimeZone({ date: new Date(), timeZone });

  return listReadyMistakes({ localDate, mistakes: entries, timeZone }).length > 0;
}
