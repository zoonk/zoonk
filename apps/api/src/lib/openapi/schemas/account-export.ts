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
    exportedAt: z.iso.datetime(),
    feedback: z
      .object({ contentVotes: rowsSchema, messages: rowsSchema })
      .meta({ description: "Votes on content and messages sent to the team" }),
    goals: rowsSchema.meta({ description: "Goals with their plans, plan items and plan changes" }),
    guardianLinks: rowsSchema.meta({ description: "Guardian invites and links, without tokens" }),
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
  })
  .meta({
    description: "Everything Zoonk keeps about the learner, as one download",
    id: "AccountDataExport",
  });
