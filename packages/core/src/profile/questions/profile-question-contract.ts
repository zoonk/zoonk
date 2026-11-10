import { type Goal } from "@zoonk/db";
import { LearnerConditionKind, LearningNeed, type ProfileQuestion } from "@zoonk/db/enums";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { MAX_MEMORY_STATEMENT_LENGTH } from "../../memory/memory-limits";
import { normalizeProfileFavorites } from "./profile-favorites";
import { PROFILE_OPTION_IDS } from "./profile-option-ids";

export const PROFILE_QUESTIONS = [
  "work",
  "tools",
  "studies",
  "watch",
  "listen",
  "play",
  "read",
  "activities",
  "conditions",
  "learningSupport",
] as const satisfies readonly ProfileQuestion[];
/** @public */
export const BIOGRAPHY_QUESTIONS = [
  "work",
  "tools",
  "studies",
  "watch",
  "listen",
  "play",
  "read",
  "activities",
] as const;
export const PROFILE_QUESTION_VERSIONS: Record<ProfileQuestion, number> = {
  activities: 1,
  conditions: 1,
  learningSupport: 1,
  listen: 1,
  play: 1,
  read: 1,
  studies: 1,
  tools: 1,
  watch: 1,
  work: 1,
};

export const profileQuestionSchema = z
  .enum(PROFILE_QUESTIONS)
  .meta({ description: "The optional question about the learner", id: "ProfileQuestion" });

export const MAX_PROFILE_FAVORITES_LENGTH = 120;
export const MAX_PROFILE_JOB_LENGTH = 80;
export const MAX_PROFILE_SUBJECT_LENGTH = 80;
export const MAX_CONDITION_NOTE_LENGTH = 120;

const declined = z
  .boolean()
  .default(false)
  .meta({ description: "Declines this question and removes its saved answer" });

const optionalText = (limit: number, description: string) =>
  z.string().trim().max(limit).nullable().default(null).meta({ description });

const picksAnswer = <const T extends readonly [string, ...string[]]>(ids: T) =>
  z
    .object({
      declined,
      favorites: z
        .string()
        .overwrite(normalizeProfileFavorites)
        .max(MAX_PROFILE_FAVORITES_LENGTH)
        .default("")
        .meta({
          description:
            "Favorites separated by commas, semicolons or line breaks; at most 120 characters",
        }),
      picks: z
        .array(z.enum(ids))
        .default([])
        .meta({ description: "Up to three distinct option ids" }),
    })
    .strict();

const studySchema = z
  .object({
    field: z
      .enum(PROFILE_OPTION_IDS.studies)
      .meta({ description: "Field studied, past or present" }),
    subject: optionalText(MAX_PROFILE_SUBJECT_LENGTH, "Course or subject; required for other"),
  })
  .strict();

const conditionSchema = z
  .object({
    condition: z
      .enum(LearnerConditionKind)
      .meta({ description: "Condition the learner consents to save" }),
    note: optionalText(
      MAX_CONDITION_NOTE_LENGTH,
      "Own words for other; omitted for every other condition",
    ),
  })
  .strict();

export const profileAnswerInputSchema = z
  .discriminatedUnion("question", [
    z
      .object({
        answer: z
          .object({
            declined,
            job: optionalText(MAX_PROFILE_JOB_LENGTH, "Current job, at most 80 characters"),
            status: z
              .enum(PROFILE_OPTION_IDS.work)
              .nullable()
              .default(null)
              .meta({ description: "The learner's current work or study status" }),
          })
          .strict(),
        question: z.literal("work"),
      })
      .strict(),
    z
      .object({ answer: picksAnswer(PROFILE_OPTION_IDS.tools), question: z.literal("tools") })
      .strict(),
    z
      .object({
        answer: z
          .object({
            declined,
            studies: z
              .array(studySchema)
              .default([])
              .meta({ description: "Up to three distinct fields" }),
          })
          .strict(),
        question: z.literal("studies"),
      })
      .strict(),
    z
      .object({ answer: picksAnswer(PROFILE_OPTION_IDS.watch), question: z.literal("watch") })
      .strict(),
    z
      .object({ answer: picksAnswer(PROFILE_OPTION_IDS.listen), question: z.literal("listen") })
      .strict(),
    z
      .object({ answer: picksAnswer(PROFILE_OPTION_IDS.play), question: z.literal("play") })
      .strict(),
    z
      .object({ answer: picksAnswer(PROFILE_OPTION_IDS.read), question: z.literal("read") })
      .strict(),
    z
      .object({
        answer: picksAnswer(PROFILE_OPTION_IDS.activities),
        question: z.literal("activities"),
      })
      .strict(),
    z
      .object({
        answer: z
          .object({
            conditions: z
              .array(conditionSchema)
              .default([])
              .meta({
                description: "The consented set, replacing every previously saved condition",
              }),
            consented: z
              .boolean()
              .default(false)
              .meta({
                description:
                  "Explicit consent to store these conditions under this question version",
              }),
            declined,
          })
          .strict(),
        question: z.literal("conditions"),
      })
      .strict(),
    z
      .object({
        answer: z
          .object({
            declined,
            needs: z
              .array(z.enum(LearningNeed))
              .default([])
              .meta({ description: "Learning supports, replacing the saved set" }),
            note: optionalText(
              MAX_MEMORY_STATEMENT_LENGTH,
              "Own words for the tutor, up to 300 characters; stored only with memory enabled",
            ),
            soundEffects: z
              .boolean()
              .optional()
              .meta({
                description:
                  "Whether reward sound effects are enabled; omission leaves the setting unchanged",
              }),
          })
          .strict(),
        question: z.literal("learningSupport"),
      })
      .strict(),
  ])
  .meta({
    description: "A complete replacement for one optional profile answer",
    id: "ProfileAnswerInput",
  });

export type ProfileAnswerInput = z.infer<typeof profileAnswerInputSchema>;
export type ProfileQuestionView = {
  id: ProfileQuestion;
  version: number;
  status: "answered" | "declined" | null;
  options: { id: string; label: string; description: string | null }[];
  saved: { picks: string[]; text: string; studies: { field: string; subject: string | null }[] };
};
export type ProfileQuestionsView = { memoryEnabled: boolean; questions: ProfileQuestionView[] };

export function isProfileQuestion(question: string): question is ProfileQuestion {
  return PROFILE_QUESTIONS.some((id) => id === question);
}
export function isBiographyQuestion(question: ProfileQuestion): boolean {
  return BIOGRAPHY_QUESTIONS.some((id) => id === question);
}

export function getProfileSteps({
  goal,
  answered,
  memoryEnabled,
}: {
  goal: Pick<Goal, "kind" | "details" | "replacesGoalId" | "planRevealedAt">;
  answered: Partial<Record<ProfileQuestion, number>>;
  memoryEnabled: boolean;
}): ProfileQuestion[] {
  if (goal.kind === "explain" || goal.replacesGoalId || goal.planRevealedAt) {
    return [];
  }

  const skipped =
    isJsonObject(goal.details) && Array.isArray(goal.details.answered) ? goal.details.answered : [];

  return PROFILE_QUESTIONS.filter(
    (question) =>
      (answered[question] ?? 0) < PROFILE_QUESTION_VERSIONS[question] &&
      !skipped.includes(question) &&
      (memoryEnabled || !isBiographyQuestion(question)),
  );
}
