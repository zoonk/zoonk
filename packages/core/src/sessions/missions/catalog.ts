import { z } from "zod";

export const MISSION_KINDS = [
  "review",
  "somethingNew",
  "finishChapter",
  "challenge",
  "weeklyChallenge",
  "mock",
  "essay",
  "practice",
  "pronunciation",
  "call",
  "askBuddy",
  "weakSpot",
] as const;

export const FIRST_STEP_KINDS = [
  "somethingNew",
  "review",
  "askBuddy",
  "essay",
  "call",
  "mock",
  "challenge",
] as const;

/** Days saved before the plan took over missed questions may hold these; reads leave them out. */
const RETIRED_MISSION_KINDS = ["fixMistake", "pattern"] as const;

export type MissionKind = (typeof MISSION_KINDS)[number];
export type FirstStepKind = (typeof FIRST_STEP_KINDS)[number];

export const MISSION_RULES = { roomyDayMinutes: 30, shortDayMinutes: 15 } as const;

const missionAnchorSchema = z.object({
  areaId: z.string().optional(),
  blockKind: z.enum(["review", "learn", "practice", "produce", "checkpoint"]).optional(),
  chapterId: z.string().optional(),
  lessonIds: z.array(z.string()).optional(),
  planItemId: z.string().optional(),
  planItemIds: z.array(z.string()).optional(),
  /** Selected checkpoint identity survives the POST assigning its saved UUID. */
  planItemKey: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
});

const missionDetailSchema = z.object({
  areaTitle: z.string().optional(),
  chapterTitle: z.string().optional(),
  count: z.int().nonnegative().optional(),
  minutes: z.number().nonnegative().optional(),
  rematch: z.boolean().optional(),
  title: z.string().optional(),
});

const missionOpensSchema = z.discriminatedUnion("kind", [
  z.object({ blockId: z.string(), kind: z.literal("block") }),
  z.object({ kind: z.literal("pronunciation") }),
  z.object({ chapterId: z.string(), kind: z.literal("call") }),
  z.object({ kind: z.literal("buddy") }),
  z.object({ areaId: z.string(), kind: z.literal("areaPractice") }),
  z.object({ kind: z.literal("mockChooser") }),
]);

const missionPickSchema = z.object({
  anchor: missionAnchorSchema,
  /** The activity outside the day's blocks that completed it, so its screen can say so on a retry. */
  completedBy: z.object({ id: z.string(), kind: z.string() }).optional(),
  detail: missionDetailSchema.optional(),
  done: z.int().nonnegative().optional(),
  firstStep: z.boolean().optional(),
  kind: z.enum(MISSION_KINDS),
  opens: missionOpensSchema.optional(),
  total: z.int().positive(),
});

const missionDocumentSchema = z.object({
  picks: z.array(missionPickSchema),
  version: z.literal(1),
});

const savedKindSchema = z.enum([...MISSION_KINDS, ...RETIRED_MISSION_KINDS]);

const retiredOpensSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mistakesPractice") }),
  z.object({ kind: z.literal("pattern"), patternId: z.string() }),
]);

const savedPickSchema = missionPickSchema.extend({
  kind: savedKindSchema,
  opens: z.union([missionOpensSchema, retiredOpensSchema]).optional(),
});

const savedDocumentSchema = missionDocumentSchema.extend({ picks: z.array(savedPickSchema) });

function isMissionKind(kind: string): kind is MissionKind {
  return MISSION_KINDS.some((current) => current === kind);
}

/** What a finished block did to missions, as saved; a retired kind is no longer a mission. */
export const savedMissionKindsSchema = z
  .array(savedKindSchema)
  .transform((kinds) => kinds.filter((kind) => isMissionKind(kind)));

export type MissionDetail = z.infer<typeof missionDetailSchema>;
export type MissionOpens = z.infer<typeof missionOpensSchema>;
export type MissionPick = z.infer<typeof missionPickSchema>;
export type MissionDocument = z.infer<typeof missionDocumentSchema>;

/** Corrupt or future documents fail closed. */
export function readMissionDocument(value: unknown): MissionDocument | null {
  const saved = savedDocumentSchema.safeParse(value).data;

  if (!saved) {
    return null;
  }

  return {
    ...saved,
    picks: saved.picks.flatMap((pick) => missionPickSchema.safeParse(pick).data ?? []),
  };
}
