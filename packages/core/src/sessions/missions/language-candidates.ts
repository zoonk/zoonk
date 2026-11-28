import { type Goal, prisma } from "@zoonk/db";
import "server-only";
import { type UsageTotals, getUsageCounts } from "../../entitlements/_utils/usage-counts";
import { type EntitlementTier } from "../../entitlements/contract";
import { MAX_PRONUNCIATION_ROUND_WORDS } from "../../language/pronunciation/pronunciation-rules";
import { type SessionPlanItem } from "../_utils/session-plan-item";
import { type MissionFactBlock } from "./block-candidates";
import { hasMissionAllowance } from "./candidate-allowance";
import { type MissionPick } from "./catalog";

const SECONDS_PER_MINUTE = 60;

export async function languageCandidates({
  blocks,
  goal,
  items,
  now,
  tier,
  usage,
  userId,
}: {
  blocks: readonly MissionFactBlock[];
  goal: Goal;
  items: readonly SessionPlanItem[];
  now: Date;
  tier: EntitlementTier;
  usage: UsageTotals;
  userId: string;
}): Promise<MissionPick[]> {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return [];
  }

  const pronunciation = await prisma.pronunciationReview.count({
    where: { dueAt: { lte: now }, language: goal.targetLanguage, userId },
  });

  const chapterId =
    blocks.find((block) => block.kind === "learn" && block.payload.chapterId)?.payload.chapterId ??
    items.find((item) => item.status === "todo" && item.chapterId)?.chapterId ??
    items.findLast((item) => item.chapterId)?.chapterId;

  const callAllowed = hasMissionAllowance({
    counts: tier === "guest" ? null : getUsageCounts(usage, "conversation"),
    kind: "conversation",
    now,
    seconds: SECONDS_PER_MINUTE,
    tier,
  });

  const pronunciationAllowed = hasMissionAllowance({
    counts: getUsageCounts(usage, "assist"),
    kind: "assist",
    now,
    tier,
    uses: Math.min(pronunciation, MAX_PRONUNCIATION_ROUND_WORDS),
  });

  const chapterTitle = items.find(
    (item) => item.chapterId === chapterId && item.kind === "chapter",
  )?.titleSnapshot;

  return [
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
  ];
}
