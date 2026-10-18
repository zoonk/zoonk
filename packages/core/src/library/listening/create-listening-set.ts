import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import {
  LISTENING_QUESTION_FORMATS,
  type ListeningQuestion,
  toListeningItem,
} from "@zoonk/ai/tasks/v2/listening/schema";
import { writeListeningSet } from "@zoonk/ai/tasks/v2/listening/write-set";
import { logError } from "@zoonk/utils/logger";
import { createItemSet } from "../items/create-item-set";
import { toListeningContent } from "./listening-content";

/** One recording of an exam's listening paper, as its set is written and found again. */
type ListeningSetPart = { count: number; plays: 1 | 2; task: string };

/** A skill the set's questions may test, as its writer reads it. */
type ListeningSetSkill = { description: string; name: string; skillId: string };

/** The question's own skill, or the first one when its number isn't on the list. */
function getSkillId({
  question,
  skills,
}: {
  question: ListeningQuestion;
  skills: readonly [ListeningSetSkill, ...ListeningSetSkill[]];
}): string {
  return (skills[question.skill - 1] ?? skills[0]).skillId;
}

/**
 * Writes one listening set for a part of an exam's listening paper and stores its script and the
 * questions that pass the item checks (`createItemSet`), unvoiced: `voiceListeningSet` voices it.
 * Shared Library content: the call holds the exam, the part and its skills, never a learner's
 * words. A set the writer couldn't make clean, or with no question left, isn't stored; the next
 * request writes another. Returns the stored set's id. An internal workflow bridge.
 */
export async function createListeningSet({
  analytics,
  exam,
  language,
  part,
  scriptLanguage,
  serviceTier,
  skills,
}: {
  analytics?: AiGenerationContext;
  exam: { blueprintId: string; name: string };
  /** The learner's language (reasons and misconceptions), the exam blueprint's. */
  language: string;
  part: ListeningSetPart;
  /** The language the recording is in, the exam's ("en" for IELTS). */
  scriptLanguage: string;
  serviceTier?: ServiceTier;
  skills: readonly ListeningSetSkill[];
}): Promise<string | null> {
  const [firstSkill, ...otherSkills] = skills;

  if (!firstSkill) {
    return null;
  }

  const written = await writeListeningSet({
    accents: [],
    analytics: { ...analytics, contentScope: "shared" },
    count: part.count,
    exam: exam.name,
    formats: LISTENING_QUESTION_FORMATS,
    language,
    level: null,
    plays: part.plays,
    scriptLanguage,
    serviceTier,
    skills,
    task: part.task,
  });

  const { problems, set } = written.data;

  if (problems.length > 0) {
    logError("A listening set kept flaws after its redraft:", problems);
    return null;
  }

  const listed = [firstSkill, ...otherSkills] as const;

  const { set: stored } = await createItemSet({
    content: toListeningContent({ plays: part.plays, scriptLanguage, set, task: part.task }),
    examBlueprintId: exam.blueprintId,
    items: set.questions.map((question) => ({
      format: question.format,
      item: toListeningItem(question),
      skillId: getSkillId({ question, skills: listed }),
    })),
    kind: "audio",
    language,
    provenance: written.provenance,
  });

  return stored?.id ?? null;
}
