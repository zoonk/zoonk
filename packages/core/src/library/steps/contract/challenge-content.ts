import { z } from "zod";
import { getChallengeGraphIssues } from "../../challenges/challenge-graph";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  optionTextSchema,
  promptSchema,
  uniqueIdsSchema,
} from "./content-schemas";

const MAX_TEAM = 4;
const MAX_METERS = 3;
const MAX_PANELS = 2;
const MAX_METRICS = 4;
const MAX_MESSAGES = 4;
const MAX_REPLIES = 3;
const MIN_CHOICES = 2;
const MAX_CHOICES = 4;
const MAX_NODES = 10;
const MAX_ENDINGS = 4;
const MAX_SKILLS = 4;
const MAX_NOTES = 2;
const METER_MAX = 100;
const MAX_METER_CHANGE = 50;

export const CHALLENGE_VARIANTS = ["work", "whatIf"] as const;

const CHALLENGE_CHOICE_QUALITIES = ["strong", "fair", "weak"] as const;

const messageSchema = z.object({ from: idSchema, text: explanationSchema }).strict();

const metricSchema = z
  .object({ label: labelSchema, note: optionTextSchema.optional(), value: labelSchema })
  .strict();

const panelSchema = z
  .object({
    metrics: z.array(metricSchema).min(1).max(MAX_METRICS),
    note: optionTextSchema.optional(),
    title: optionTextSchema.optional(),
  })
  .strict();

const teamSlotSchema = z
  .object({ ai: z.boolean(), expertise: optionTextSchema, id: idSchema, role: labelSchema })
  .strict();

const meterSchema = z
  .object({
    goodWhen: z.enum(["high", "low"]),
    id: idSchema,
    label: labelSchema,
    start: z.int().min(0).max(METER_MAX),
  })
  .strict();

const noteSchema = z
  .object({
    example: optionTextSchema.optional(),
    kind: z.enum(["good", "improve"]),
    skill: idSchema,
    text: explanationSchema,
  })
  .strict();

const timeJumpSchema = z.object({ label: labelSchema, panel: panelSchema.optional() }).strict();

const choiceSchema = z
  .object({
    effects: z
      .array(
        z
          .object({ change: z.int().min(-MAX_METER_CHANGE).max(MAX_METER_CHANGE), meter: idSchema })
          .strict(),
      )
      .max(MAX_METERS),
    id: idSchema,
    next: idSchema,
    notes: z.array(noteSchema).max(MAX_NOTES),
    quality: z.enum(CHALLENGE_CHOICE_QUALITIES),
    replies: z.array(messageSchema).max(MAX_REPLIES),
    text: optionTextSchema,
    timeJump: timeJumpSchema.optional(),
  })
  .strict();

const nodeSchema = z
  .object({
    choices: uniqueIdsSchema(choiceSchema, { max: MAX_CHOICES, min: MIN_CHOICES }),
    id: idSchema,
    messages: z.array(messageSchema).max(MAX_MESSAGES),
    prompt: promptSchema,
  })
  .strict();

const endingSchema = z.object({ id: idSchema, outcome: explanationSchema }).strict();

const skillSchema = z
  .object({ id: idSchema, name: labelSchema, practice: explanationSchema })
  .strict();

const challengeShapeSchema = z
  .object({
    deadline: optionTextSchema.optional(),
    endings: uniqueIdsSchema(endingSchema, { max: MAX_ENDINGS, min: 1 }),
    meters: uniqueIdsSchema(meterSchema, { max: MAX_METERS, min: 0 }),
    mission: explanationSchema,
    nodes: uniqueIdsSchema(nodeSchema, { max: MAX_NODES, min: 1 }),
    panels: z.array(panelSchema).max(MAX_PANELS),
    setting: labelSchema,
    skills: uniqueIdsSchema(skillSchema, { max: MAX_SKILLS, min: 1 }),
    startNodeId: idSchema,
    team: uniqueIdsSchema(teamSlotSchema, { max: MAX_TEAM, min: 1 }),
    title: promptSchema,
    variant: z.enum(CHALLENGE_VARIANTS),
  })
  .strict();

export type ChallengeContent = z.output<typeof challengeShapeSchema>;
export type ChallengeNode = ChallengeContent["nodes"][number];
export type ChallengeChoice = ChallengeNode["choices"][number];
export type ChallengeEnding = ChallengeContent["endings"][number];
export type ChallengeNote = ChallengeChoice["notes"][number];
export type ChallengeMeter = ChallengeContent["meters"][number];
export type ChallengeTeamSlot = ChallengeContent["team"][number];

export const challengeContentSchema = challengeShapeSchema.superRefine((content, context) => {
  for (const problem of getChallengeGraphIssues(content)) {
    context.addIssue({ code: "custom", message: problem.message, path: problem.path });
  }
});
