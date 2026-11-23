import "server-only";
import {
  type Attempt,
  type Goal,
  type LearningEvent,
  type StepKind,
  type TransactionClient,
} from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { availableLevelTestOut } from "../../language/level-test/_utils/level-test-out-items";
import { levelTestOutLevelSchema } from "../../language/level-test/level-test-contract";
import { recordLanguageLessonWindow } from "../../language/levels/record-language-evidence";
import { getStepLanguageSkill } from "../../language/levels/skill-level-rules";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getRunStudySessionId } from "../../lesson-player/_utils/lesson-runs";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type ClosedLivingPlanWindow, recordLivingPlanAnswers } from "./living-plan-window";

async function selectPlacementOffer({
  goal,
  now,
  tx,
  userId,
  window,
}: {
  goal: Pick<Goal, "id" | "timezone">;
  now: Date;
  tx: TransactionClient;
  userId: string;
  window: ClosedLivingPlanWindow | null;
}) {
  if (window?.result !== "easy" || window.streak < 2) {
    return null;
  }

  const { id: goalId } = goal;

  const candidate = levelTestOutLevelSchema.safeParse(window.levelTestOut).data;

  const level = await availableLevelTestOut({
    goalId,
    levels: candidate ? [candidate] : [],
    now,
    timeZone: getAnswerTimeZone({ goal }),
    tx,
    userId,
  });

  if (level) {
    return { goalId, kind: "levelTestOut", level } as const;
  }

  return window.streak === 2 ? ({ goalId, kind: "quick" } as const) : null;
}

export async function recordLessonWindowAnswer(
  tx: TransactionClient,
  {
    attempt,
    kind,
    lessonId,
    run: knownRun,
  }: {
    attempt: Attempt;
    kind: StepKind;
    lessonId: string;
    run?: Pick<LearningEvent, "contentIds" | "id">;
  },
): Promise<void> {
  const { answeredAt: at, id, isCorrect, skillId, stepId, userId } = attempt;

  if (!stepId) {
    return;
  }

  const prior = await tx.attempt.findFirst({
    select: { id: true },
    where: { id: { not: id }, stepId, userId },
  });

  if (prior) {
    return;
  }

  const run =
    knownRun ??
    (await tx.learningEvent.findFirst({
      orderBy: { startedAt: "desc" },
      select: { contentIds: true, id: true },
      where: {
        contentIds: { equals: lessonId, path: ["lessonId"] },
        endedAt: null,
        kind: "lesson",
        userId,
      },
    }));

  if (!run) {
    return;
  }

  const sessionId = getRunStudySessionId(run);

  const session = sessionId
    ? await tx.studySession.findUnique({
        select: { goalId: true, localDate: true },
        where: { id: sessionId, userId },
      })
    : null;

  const goal = await tx.goal.findFirst({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      details: true,
      id: true,
      kind: true,
      livingPlanWindow: true,
      targetLanguage: true,
      timezone: true,
      updatedAt: true,
    },
    where: {
      kind: { in: ["learn", "language"] },
      status: "active",
      userId,
      ...(session?.goalId ? { id: session.goalId } : { plan: { items: { some: { lessonId } } } }),
    },
  });

  if (!goal) {
    return;
  }

  const answers = [{ isCorrect, skillId }];

  const closed = await saveLessonWindow(tx, {
    answers,
    at,
    goal,
    kind,
    sessionDay: session ? toIsoDate(session.localDate) : undefined,
    userId,
  });

  if (closed?.at !== at.toISOString()) {
    return;
  }

  const placementOffer = await selectPlacementOffer({ goal, now: at, tx, userId, window: closed });

  if (placementOffer) {
    await tx.$executeRaw`
      UPDATE learning_events
      SET content_ids = jsonb_set(content_ids, '{placementOffer}', ${JSON.stringify(placementOffer)}::jsonb)
      WHERE id = ${run.id}::uuid AND user_id = ${userId}::uuid
        AND ended_at IS NULL
    `;
  }
}

async function saveLessonWindow(
  tx: TransactionClient,
  {
    answers,
    at,
    goal,
    kind,
    sessionDay,
    userId,
  }: {
    answers: Parameters<typeof recordLivingPlanAnswers>[0]["answers"];
    at: Date;
    goal: Pick<
      Goal,
      "details" | "id" | "kind" | "livingPlanWindow" | "targetLanguage" | "updatedAt"
    >;
    kind: StepKind;
    sessionDay?: string;
    userId: string;
  },
) {
  if (goal.kind === "language") {
    const skill = getStepLanguageSkill(kind);

    return goal.targetLanguage && skill
      ? recordLanguageLessonWindow(tx, {
          answers,
          at,
          details: isJsonObject(goal.details) ? goal.details : {},
          language: goal.targetLanguage,
          sessionDay,
          skill,
          userId,
        })
      : null;
  }

  const window = recordLivingPlanAnswers({
    answers,
    at,
    sessionDay,
    stored: goal.livingPlanWindow,
  });

  await tx.goal.update({
    data: { livingPlanWindow: window, updatedAt: goal.updatedAt },
    where: { id: goal.id },
  });

  return window.total === 0 ? window.closed : null;
}
