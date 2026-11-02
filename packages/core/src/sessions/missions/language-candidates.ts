import { type Goal, prisma } from "@zoonk/db";
import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { countUsage } from "../../entitlements/_utils/usage-counts";
import { type EntitlementTier } from "../../entitlements/contract";
import { mistakePatternContentSchema } from "../../language/patterns/pattern-contract";
import { MAX_PRONUNCIATION_ROUND_WORDS } from "../../language/pronunciation/pronunciation-rules";
import { type SessionPlanItem } from "../_utils/session-plan-item";
import { type MissionFactBlock } from "./block-candidates";
import { hasMissionAllowance } from "./candidate-allowance";
import { type MissionPick } from "./catalog";

const FRESH_PATTERN_DAYS = 7;
const SECONDS_PER_MINUTE = 60;

export async function languageCandidates({
  blocks,
  goal,
  items,
  now,
  tier,
  userId,
}: {
  blocks: readonly MissionFactBlock[];
  goal: Goal;
  items: readonly SessionPlanItem[];
  now: Date;
  tier: EntitlementTier;
  userId: string;
}): Promise<{ candidates: MissionPick[]; patternExpiresTomorrow: boolean }> {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return { candidates: [], patternExpiresTomorrow: false };
  }

  const [patterns, pronunciation, usage, assistUsage] = await Promise.all([
    prisma.mistakePattern.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: {
        createdAt: { gte: new Date(now.getTime() - FRESH_PATTERN_DAYS * MS_PER_DAY), lte: now },
        dismissedAt: null,
        kind: "pattern",
        language: goal.targetLanguage,
        practicedAt: null,
        userId,
      },
    }),
    prisma.pronunciationReview.count({
      where: { dueAt: { lte: now }, language: goal.targetLanguage, userId },
    }),
    tier === "guest" ? null : countUsage({ client: prisma, kind: "conversation", now, userId }),
    countUsage({ client: prisma, kind: "assist", now, userId }),
  ]);

  const pattern = patterns.find(
    (row) => (mistakePatternContentSchema.safeParse(row.content).data?.drill.length ?? 0) > 0,
  );

  const chapterId =
    blocks.find((block) => block.kind === "learn" && block.payload.chapterId)?.payload.chapterId ??
    items.find((item) => item.status === "todo" && item.chapterId)?.chapterId ??
    items.findLast((item) => item.chapterId)?.chapterId;

  const callAllowed = hasMissionAllowance({
    counts: usage,
    kind: "conversation",
    now,
    seconds: SECONDS_PER_MINUTE,
    tier,
  });

  const pronunciationAllowed = hasMissionAllowance({
    counts: assistUsage,
    kind: "assist",
    now,
    tier,
    uses: Math.min(pronunciation, MAX_PRONUNCIATION_ROUND_WORDS),
  });

  const chapterTitle = items.find(
    (item) => item.chapterId === chapterId && item.kind === "chapter",
  )?.titleSnapshot;

  return {
    candidates: [
      ...(pattern
        ? [
            {
              anchor: { patternId: pattern.id },
              detail: { patternTitle: pattern.title },
              kind: "pattern" as const,
              opens: { kind: "pattern" as const, patternId: pattern.id },
              total: 1,
            },
          ]
        : []),
      ...(pronunciationAllowed
        ? [
            {
              anchor: {},
              kind: "pronunciation" as const,
              opens: { kind: "pronunciation" as const },
              total: 1,
            },
          ]
        : []),
      ...(callAllowed && chapterId
        ? [
            {
              anchor: { chapterId },
              detail: chapterTitle ? { chapterTitle } : {},
              kind: "call" as const,
              opens: { chapterId, kind: "call" as const },
              total: 1,
            },
          ]
        : []),
    ],
    patternExpiresTomorrow: Boolean(
      pattern &&
      pattern.createdAt.getTime() + FRESH_PATTERN_DAYS * MS_PER_DAY <= now.getTime() + MS_PER_DAY,
    ),
  };
}
