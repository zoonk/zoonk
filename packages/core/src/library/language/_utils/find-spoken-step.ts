import "server-only";
import { findPlayableStepRow, getAnswerSkillId } from "../../../lesson-player/_utils/lesson-rows";
import { loadPlayableSteps } from "../../../lesson-player/_utils/load-playable-steps";
import { type MistakeReplay } from "../../../mistakes/mistake-replay";

export async function findSpokenStep({ stepId, userId }: { stepId: string; userId: string }) {
  const row = await findPlayableStepRow({ stepId, userId });

  if (!row || row.kind !== "spokenAnswer") {
    return null;
  }

  const [step] = await loadPlayableSteps({ lesson: row.lesson, rows: [row] });

  if (step?.kind !== "spokenAnswer") {
    return null;
  }

  const { content } = step;

  const replay: MistakeReplay = {
    kind: "lesson",
    lesson: {
      language: row.lesson.language,
      lessonId: row.lessonId,
      level: row.lesson.level,
      step,
      targetLanguage: row.lesson.targetLanguage,
    },
  };

  return {
    content,
    id: step.id,
    learnerLanguage: row.lesson.language,
    lessonId: row.lessonId,
    level: row.lesson.level,
    replay,
    retiredAt: row.retiredAt,
    romanization: content.romanization,
    sentenceId: row.sentenceId,
    skillId: getAnswerSkillId({
      lessonSkillIds: row.lesson.skills.map((skill) => skill.skillId),
      stepSkillId: step.skillId,
    }),
    storedContent: row.content,
    targetLanguage: content.language,
    targetText: content.targetText,
    wordId: row.wordId,
  };
}

export type SpokenStep = NonNullable<Awaited<ReturnType<typeof findSpokenStep>>>;
