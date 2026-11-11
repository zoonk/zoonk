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

const MIN_CHOICES = 2;
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
    metrics: z.array(metricSchema).min(1),
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
    effects: z.array(
      z
        .object({ change: z.int().min(-MAX_METER_CHANGE).max(MAX_METER_CHANGE), meter: idSchema })
        .strict(),
    ),
    id: idSchema,
    next: idSchema,
    notes: z.array(noteSchema),
    quality: z.enum(CHALLENGE_CHOICE_QUALITIES),
    replies: z.array(messageSchema),
    text: optionTextSchema,
    timeJump: timeJumpSchema.optional(),
  })
  .strict();

const nodeSchema = z
  .object({
    choices: uniqueIdsSchema(choiceSchema, { min: MIN_CHOICES }),
    id: idSchema,
    messages: z.array(messageSchema),
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
    endings: uniqueIdsSchema(endingSchema, { min: 1 }),
    meters: uniqueIdsSchema(meterSchema, { min: 0 }),
    mission: explanationSchema,
    nodes: uniqueIdsSchema(nodeSchema, { min: 1 }),
    panels: z.array(panelSchema),
    setting: labelSchema,
    skills: uniqueIdsSchema(skillSchema, { min: 1 }),
    startNodeId: idSchema,
    team: uniqueIdsSchema(teamSlotSchema, { min: 1 }),
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
