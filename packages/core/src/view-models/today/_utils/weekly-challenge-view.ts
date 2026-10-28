import "server-only";
import { prisma } from "@zoonk/db";
import { findNextWeeklyItem } from "../../../checkpoints/_utils/load-weekly-challenge";
import { loadMockCard } from "../../../checkpoints/_utils/mock-card";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import {
  type WeeklyChallengeResult,
  getWeeklyChallenge,
  getWeeklyQuestions,
} from "../../../checkpoints/get-weekly-challenge";
import { readExamBlueprint } from "../../../library/exams/read-exam-blueprint";
import { type SelectedDayPlan } from "../../../sessions/_utils/selected-day-plan";
import { type SessionPlanItem } from "../../../sessions/_utils/session-plan-item";
import { type DayView } from "../../../sessions/day-view";
import { type TodayView } from "../get-today-view";

/** The actual weekly checkpoint's card, without exposing its preparation payload. */
function toWeeklyChallenge(result: WeeklyChallengeResult): TodayView["weeklyChallenge"] {
  if (result.status !== "ready" || !result.challenge) {
    return null;
  }

  const { challenge } = result;

  return {
    access: challenge.access,
    date: challenge.date,
    kind: challenge.kind,
    planItemId: challenge.planItemId,
    questions: challenge.questions,
    timeLimitMinutes: challenge.conditions?.timeLimitMinutes ?? null,
    title: challenge.title,
  };
}

/** The same authorized in-memory selection supplies the card's date, identity and funding. */
async function readSelectedCard({
  item,
  selection,
  session,
}: {
  item: SessionPlanItem;
  selection: SelectedDayPlan;
  session: DayView;
}): Promise<TodayView["weeklyChallenge"]> {
  const { goal } = selection.context;
  const isMock = item.kind === "mock";

  const blueprint =
    isMock && goal.examBlueprintId ? await readExamBlueprint(goal.examBlueprintId) : null;

  const card = isMock
    ? await loadMockCard({
        blueprint,
        date: item.scheduledFor ?? session.localDate,
        goal,
        source: selection.source,
        today: session.localDate,
      })
    : null;

  return {
    access: isMock && !session.examAccess.includesMockExams ? "plusRequired" : "open",
    date: item.scheduledFor,
    kind: isMock ? "mock" : "mixed",
    planItemId: item.id,
    questions: getWeeklyQuestions({ conditions: card?.conditions, item }),
    timeLimitMinutes: card?.conditions.timeLimitMinutes ?? null,
    title: item.titleSnapshot.trim() || null,
  };
}

/** Internal: Today already resolved the owned goal and its authoritative day. */
export async function readTodayWeeklyChallenge({
  goalId,
  selection,
  timeZone,
  session,
}: {
  goalId: string;
  selection?: SelectedDayPlan | null;
  timeZone?: string;
  session: DayView;
}): Promise<TodayView["weeklyChallenge"]> {
  const item = selection
    ? findNextWeeklyItem(selection.items)
    : await prisma.planItem.findFirst({
        orderBy: { position: "asc" },
        where: { kind: { in: ["checkpoint", "mock"] }, plan: { goalId }, status: "todo" },
      });

  if (!item) {
    return null;
  }

  const block = session.blocks.find(
    (candidate) =>
      candidate.planItemId === item.id &&
      candidate.checkpoint?.kind === "weekly" &&
      candidate.questions >= MIN_CHECKPOINT_QUESTIONS,
  );

  if (block?.checkpoint) {
    return {
      access:
        block.checkpoint.mock && !session.examAccess.includesMockExams ? "plusRequired" : "open",
      date: item.scheduledFor,
      kind: block.checkpoint.mock ? "mock" : "mixed",
      planItemId: item.id,
      questions: block.questions,
      timeLimitMinutes: block.checkpoint.timeLimitMinutes,
      title: item.titleSnapshot.trim() || null,
    };
  }

  return selection
    ? readSelectedCard({ item, selection, session })
    : toWeeklyChallenge(await getWeeklyChallenge({ goalId, timeZone }));
}
