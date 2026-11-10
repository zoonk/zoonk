import { profileQuestionSchema } from "@zoonk/core/profile/questions/contract";
import { LearnerConditionKind, LearningNeed } from "@zoonk/db/enums";
import { z } from "zod";
import { learningProfileSchema } from "./learning-profile";
import { memoryExportSchema } from "./memory";

const rowsSchema = z.array(z.record(z.string(), z.unknown()));

export const accountDataExportSchema = z
  .object({
    account: z
      .object({
        createdAt: z.iso.datetime(),
        email: z.string(),
        image: z.string().nullable(),
        name: z.string(),
        username: z.string().nullable(),
      })
      .meta({ description: "The account's name, username, email and creation date" }),
    answers: z.object({ attempts: rowsSchema }).meta({ description: "Every answer" }),
    buddy: z
      .object({ conversations: rowsSchema, exampleLines: rowsSchema })
      .meta({
        description:
          "Conversations with the buddy (per lesson, chapter, goal or mock, with each question and answer) and the example lines lessons wrote from memory",
      }),
    conditions: z
      .array(
        z.object({
          condition: z.enum(LearnerConditionKind).meta({ description: "Consented condition" }),
          createdAt: z.iso.datetime().meta({ description: "When the condition was saved" }),
          note: z.string().nullable().meta({ description: "The learner's own words for other" }),
        }),
      )
      .meta({ description: "Every consented condition, including its note" }),
    exportedAt: z.iso.datetime(),
    feedback: z
      .object({ messages: rowsSchema })
      .meta({ description: "Votes on content and messages sent to the team" }),
    goals: rowsSchema.meta({ description: "Goals with their plans, plan items and plan changes" }),
    language: z
      .object({
        calls: rowsSchema,
        levels: rowsSchema,
        mistakePatterns: rowsSchema,
        pronunciationReviews: rowsSchema,
        words: rowsSchema,
      })
      .meta({
        description: "Language levels, words, pronunciation reviews, calls and mistake patterns",
      }),
    learnerModel: z
      .object({
        certificates: rowsSchema,
        milestones: rowsSchema,
        mistakes: rowsSchema,
        skills: rowsSchema,
      })
      .meta({ description: "Skill states, the mistakes notebook, milestones and certificates" }),
    learningNeeds: z.array(z.enum(LearningNeed)).meta({ description: "Saved learning supports" }),
    memory: memoryExportSchema,
    profile: learningProfileSchema,
    profileAnswers: z
      .array(
        z.object({
          answeredAt: z.iso
            .datetime()
            .meta({ description: "When this answer or consent was saved" }),
          outcome: z
            .enum(["answered", "declined"])
            .meta({ description: "Saved answer or explicit decline" }),
          question: profileQuestionSchema,
          version: z.int().meta({ description: "Question version answered" }),
        }),
      )
      .meta({ description: "Every profile question status record" }),
    progress: z
      .object({
        daily: rowsSchema,
        learningEvents: rowsSchema,
        totals: z.record(z.string(), z.unknown()).nullable(),
      })
      .meta({ description: "Brain Power and Energy totals, daily totals and the learning ledger" }),
    start: z
      .object({
        drafts: rowsSchema,
        instrumentWaitlist: rowsSchema,
        sources: rowsSchema,
        suggestedGoals: rowsSchema,
      })
      .meta({
        description:
          "Goals typed before a plan, goals suggested from earlier courses, added sources and instrument waitlists",
      }),
    study: z
      .object({ examResults: rowsSchema, mockExams: rowsSchema, sessions: rowsSchema })
      .meta({ description: "Study sessions with their blocks, mock exams and exam results" }),
    usage: rowsSchema.meta({ description: "Use of daily and monthly allowances" }),
  })
  .meta({
    description: "Everything Zoonk keeps about the learner, as one download",
    id: "AccountDataExport",
  });
