import { z } from "zod";
import { learningProfileSchema } from "./learning-profile";
import { memoryExportSchema } from "./memory";

/** Stored rows keep their own columns, so an export is readable without a schema per table. */
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
    exportedAt: z.iso.datetime(),
    feedback: z
      .object({ contentVotes: rowsSchema, messages: rowsSchema })
      .meta({ description: "Votes on content and messages sent to the team" }),
    goals: rowsSchema.meta({ description: "Goals with their plans, plan items and plan changes" }),
    guardianLinks: rowsSchema.meta({ description: "Guardian invites and links, without tokens" }),
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
      .object({ milestones: rowsSchema, mistakes: rowsSchema, skills: rowsSchema })
      .meta({ description: "Skill states, the mistakes notebook and milestones" }),
    memory: memoryExportSchema,
    profile: learningProfileSchema,
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
