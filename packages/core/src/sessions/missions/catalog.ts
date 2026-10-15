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
  "fixMistake",
  "pattern",
  "pronunciation",
  "call",
  "askBuddy",
  "weakSpot",
] as const;

export const FIRST_STEP_KINDS = [
  "somethingNew",
  "review",
  "fixMistake",
  "pattern",
  "askBuddy",
  "essay",
  "call",
  "mock",
  "challenge",
] as const;

export type MissionKind = (typeof MISSION_KINDS)[number];
export type FirstStepKind = (typeof FIRST_STEP_KINDS)[number];

export const MISSION_RULES = {
  mistakePileSize: 5,
  roomyDayMinutes: 30,
  shortDayMinutes: 15,
} as const;

const missionAnchorSchema = z.object({
  areaId: z.string().optional(),
  blockKind: z.enum(["review", "learn", "practice", "produce", "checkpoint"]).optional(),
  chapterId: z.string().optional(),
  lessonIds: z.array(z.string()).optional(),
  patternId: z.string().optional(),
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
  patternTitle: z.string().optional(),
  rematch: z.boolean().optional(),
  title: z.string().optional(),
});

const missionOpensSchema = z.discriminatedUnion("kind", [
  z.object({ blockId: z.string(), kind: z.literal("block") }),
  z.object({ kind: z.literal("mistakesPractice") }),
  z.object({ kind: z.literal("pattern"), patternId: z.string() }),
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

export type MissionDetail = z.infer<typeof missionDetailSchema>;
export type MissionOpens = z.infer<typeof missionOpensSchema>;
export type MissionPick = z.infer<typeof missionPickSchema>;
export type MissionDocument = z.infer<typeof missionDocumentSchema>;

/** Null identifies sessions built before mission persistence; corrupt or future documents fail closed. */
export function readMissionDocument(value: unknown): MissionDocument | null {
  return missionDocumentSchema.safeParse(value).data ?? null;
}
