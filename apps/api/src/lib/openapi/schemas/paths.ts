import { PRIVATE_FILE_FOLDERS } from "@zoonk/utils/user-blobs";
import { z } from "zod";

export const coursePathParamsSchema = z
  .object({ courseId: z.uuid().meta({ description: "Course ID" }) })
  .meta({ id: "CoursePathParams" });

export const chapterPathParamsSchema = z
  .object({ chapterId: z.uuid().meta({ description: "Chapter ID" }) })
  .meta({ id: "ChapterPathParams" });

export const lessonPathParamsSchema = z
  .object({ lessonId: z.uuid().meta({ description: "Lesson ID" }) })
  .meta({ id: "LessonPathParams" });

export const lessonQuestionPathParamsSchema = z
  .object({ questionId: z.uuid().meta({ description: "Lesson question ID" }) })
  .meta({ id: "LessonQuestionPathParams" });

export const generationPathParamsSchema = z
  .object({ generationId: z.string().trim().min(1).meta({ description: "Generation ID" }) })
  .meta({ id: "GenerationPathParams" });

export const goalPathParamsSchema = z
  .object({ goalId: z.uuid().meta({ description: "Goal ID" }) })
  .meta({ id: "GoalPathParams" });

export const goalUnderstandingPathParamsSchema = z
  .object({
    understandingId: z
      .uuid()
      .meta({ description: "Goal understanding ID: the typed goal's draft" }),
  })
  .meta({ id: "GoalUnderstandingPathParams" });

export const goalChapterPathParamsSchema = goalPathParamsSchema
  .extend({ chapterId: z.uuid().meta({ description: "Library chapter ID in the goal's plan" }) })
  .meta({ id: "GoalChapterPathParams" });

export const mistakePathParamsSchema = z
  .object({ mistakeId: z.uuid().meta({ description: "Mistake ID" }) })
  .meta({ id: "MistakePathParams" });

export const instrumentWaitlistEntryPathParamsSchema = z
  .object({ entryId: z.uuid().meta({ description: "Instrument waitlist entry ID" }) })
  .meta({ id: "InstrumentWaitlistEntryPathParams" });

export const memoryFactPathParamsSchema = z
  .object({ factId: z.uuid().meta({ description: "Memory fact ID" }) })
  .meta({ id: "MemoryFactPathParams" });

export const memoryInsightPathParamsSchema = z
  .object({ insightId: z.uuid().meta({ description: "Memory insight ID" }) })
  .meta({ id: "MemoryInsightPathParams" });

export const planChangePathParamsSchema = goalPathParamsSchema
  .extend({ changeId: z.uuid().meta({ description: "Plan change ID" }) })
  .meta({ id: "PlanChangePathParams" });

export const planLinkPathParamsSchema = z
  .object({ planId: z.uuid().meta({ description: "Plan ID from a shared plan link" }) })
  .meta({ id: "PlanLinkPathParams" });

export const suggestedGoalPathParamsSchema = z
  .object({ suggestionId: z.uuid().meta({ description: "Suggested goal ID" }) })
  .meta({ id: "SuggestedGoalPathParams" });

export const studySessionPathParamsSchema = z
  .object({ sessionId: z.uuid().meta({ description: "Study session ID" }) })
  .meta({ id: "StudySessionPathParams" });

export const studyBlockPathParamsSchema = studySessionPathParamsSchema
  .extend({ blockId: z.uuid().meta({ description: "Study session block ID" }) })
  .meta({ id: "StudyBlockPathParams" });

export const checkpointPathParamsSchema = z
  .object({ blockId: z.uuid().meta({ description: "The checkpoint's study session block ID" }) })
  .meta({ id: "CheckpointPathParams" });

export const checkpointMovePathParamsSchema = checkpointPathParamsSchema
  .extend({ changeId: z.uuid().meta({ description: "The plan change that moved it" }) })
  .meta({ id: "CheckpointMovePathParams" });

export const challengePathParamsSchema = z
  .object({ planItemId: z.uuid().meta({ description: "The challenge's plan item ID" }) })
  .meta({ id: "ChallengePathParams" });

export const challengeMovePathParamsSchema = challengePathParamsSchema
  .extend({ changeId: z.uuid().meta({ description: "The plan change that moved it" }) })
  .meta({ id: "ChallengeMovePathParams" });

export const essayPathParamsSchema = z
  .object({ blockId: z.uuid().meta({ description: "The writing block's study session block ID" }) })
  .meta({ id: "EssayPathParams" });

export const mockPathParamsSchema = z
  .object({
    blockId: z
      .uuid()
      .meta({
        description:
          "The id the mock opens by: its study session block's for a mock the plan scheduled, its own for one taken any time",
      }),
  })
  .meta({ id: "MockPathParams" });

export const mockSectionPathParamsSchema = mockPathParamsSchema
  .extend({
    section: z.coerce
      .number()
      .int()
      .min(0)
      .meta({ description: "The section's index in the mock, from 0" }),
  })
  .meta({ id: "MockSectionPathParams" });

export const milestonePathParamsSchema = z
  .object({ milestoneId: z.uuid().meta({ description: "Milestone ID" }) })
  .meta({ id: "MilestonePathParams" });

export const ownFilePathParamsSchema = z
  .object({
    folder: z
      .enum(PRIVATE_FILE_FOLDERS)
      .meta({ description: "`images` (a private course's pictures) or `sources` (uploads)" }),
    name: z.string().min(1).meta({ description: "The file's name" }),
    ownerId: z.uuid().meta({ description: "The learner the file belongs to" }),
  })
  .meta({ id: "OwnFilePathParams" });
