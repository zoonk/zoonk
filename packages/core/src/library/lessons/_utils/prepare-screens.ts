import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { PlanInputWriteConflictError, lockPlanSourceWrite } from "../../_utils/plan-input-write";
import { getLessonScreenSkillId, isNotebookQuestionStep } from "./lesson-screen-skill";
import { type LessonScreenToSave } from "./save-lesson-content";

function repairScreenSkill({
  lessonId,
  lessonSkillIds,
  screen,
}: {
  lessonId: string;
  lessonSkillIds: string[];
  screen: LessonScreenToSave;
}): LessonScreenToSave {
  if (!isNotebookQuestionStep(screen)) {
    return screen;
  }

  const skillId = getLessonScreenSkillId({ lessonSkillIds, skillId: screen.skillId });

  if (!skillId) {
    throw new Error(`Cannot publish question screens: lesson ${lessonId} has no linked skill.`);
  }

  return { ...screen, skillId };
}

async function prepareScreens(
  tx: TransactionClient,
  { lessonId, screens: uncheckedScreens }: { lessonId: string; screens: LessonScreenToSave[] },
): Promise<LessonScreenToSave[]> {
  const links = await tx.lessonSkill.findMany({
    orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
    where: { lessonId },
  });

  const lessonSkillIds = links.map((link) => link.skillId);

  const skills = await tx.skill.findMany({
    where: {
      id: {
        in: [
          ...new Set(
            uncheckedScreens.flatMap((screen) =>
              screen.skillId && isUuid(screen.skillId) ? [screen.skillId] : [],
            ),
          ),
        ],
      },
    },
  });

  const survivorIds = new Map(skills.map((skill) => [skill.id, skill.mergedIntoId ?? skill.id]));

  return uncheckedScreens.map((screen) =>
    repairScreenSkill({
      lessonId,
      lessonSkillIds,
      screen: {
        ...screen,
        skillId: screen.skillId ? (survivorIds.get(screen.skillId) ?? null) : null,
      },
    }),
  );
}

export async function lockPreparedScreens(
  tx: TransactionClient,
  { lessonId, screens }: { lessonId: string; screens: LessonScreenToSave[] },
): Promise<LessonScreenToSave[]> {
  const prepared = await prepareScreens(tx, { lessonId, screens });
  await lockPlanSourceWrite(tx, { lessonIds: [lessonId], skillIds: listItemSkillIds(prepared) });
  const locked = await prepareScreens(tx, { lessonId, screens });

  if (locked.some((screen, index) => screen.skillId !== prepared[index]?.skillId)) {
    throw new PlanInputWriteConflictError("The lesson's skills changed; try the write again.");
  }

  return locked;
}

function listItemSkillIds(screens: readonly LessonScreenToSave[]): string[] {
  return [
    ...new Set(
      screens.flatMap((screen) => (screen.mathItem && screen.skillId ? [screen.skillId] : [])),
    ),
  ];
}
