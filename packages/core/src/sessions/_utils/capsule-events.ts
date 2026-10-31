import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { type BlockPayload } from "../block-payload";
import { loadCapsuleHistory } from "./capsule-history";
import { type SessionAnswer } from "./session-answers";
import { type StudySessionRow } from "./study-session-access";

export function trackCapsulesOpened({
  payload,
  session,
  answers,
}: {
  answers: readonly SessionAnswer[];
  payload: BlockPayload;
  session: StudySessionRow;
}): void {
  if (payload.capsules.length === 0) {
    return;
  }

  const now = Date.now();

  after(async () => {
    const earlier = await loadCapsuleHistory({
      itemIds: payload.capsules.flatMap((capsule) => capsule.itemIds),
      sessionId: session.id,
      userId: session.userId,
    });

    await trackLearnerEvents({
      events: payload.capsules
        .filter((capsule) =>
          answers.some((answer) => answer.itemId && capsule.itemIds.includes(answer.itemId)),
        )
        .map((capsule) => {
          const sealed = earlier
            .filter((answer) => answer.itemId && capsule.itemIds.includes(answer.itemId))
            .map((answer) => answer.answeredAt.getTime());

          return {
            name: "Capsule Opened" as const,
            properties: {
              days_since_sealed:
                sealed.length > 0 ? Math.floor((now - Math.max(...sealed)) / MS_PER_DAY) : 0,
              lesson_id: capsule.lessonId,
            },
          };
        }),
      goalId: session.goalId,
      userId: session.userId,
    });
  });
}
