import { type Route } from "@playwright/test";
import { anyPlanOperationSchema } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { z } from "zod";

function uiMessageEvent(event: object) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Answers a tutor question with `answer`, streamed like the API does (an AI SDK UI message
 * stream). `parts` are data parts sent after the words, such as the plan change the buddy proposed.
 */
export function fulfillTutorAnswer(
  route: Route,
  answer: string,
  parts: { data: unknown; type: `data-${string}` }[] = [],
) {
  return route.fulfill({
    body: [
      uiMessageEvent({ type: "start" }),
      uiMessageEvent({ id: "answer", type: "text-start" }),
      uiMessageEvent({ delta: answer, id: "answer", type: "text-delta" }),
      uiMessageEvent({ id: "answer", type: "text-end" }),
      ...parts.map((part) => uiMessageEvent(part)),
      uiMessageEvent({ type: "finish" }),
      "data: [DONE]\n\n",
    ].join(""),
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    },
    status: 200,
  });
}

const proposalPayloadSchema = z.object({ operations: z.array(anyPlanOperationSchema) });

/** A proposal as the conversation shows it, from the change core saved. */
export function toProposal(change: {
  createdAt: Date;
  id: string;
  payload: unknown;
}): PlanChangeView {
  const { operations } = proposalPayloadSchema.parse(change.payload);

  return {
    behind: null,
    canApply: true,
    canUndo: false,
    createdAt: change.createdAt.toISOString(),
    days: null,
    effect: null,
    examDocument: "notice",
    id: change.id,
    kind: "edited",
    lessonsSkipped: 0,
    officialDate: null,
    operations,
    // A change read from the learner's words is said from what it does, never the model's words.
    reason: null,
    seen: false,
    source: "planEdit",
    status: "proposed",
    todaySession: null,
  };
}

/** How many days after UTC's today the rest day is: no time zone's date is more than a day off. */
const REST_DAY_DAYS_AHEAD = 2;

/**
 * A proposal to rest on a weekday that's still ahead for the learner whatever day the test runs:
 * two days after today in UTC, which no time zone has reached yet. A future rest day leaves today's
 * session as it was. `name` is the weekday as the card says it.
 */
export async function proposeFutureRestDay(planId: string) {
  const day = new Date(toUTCMidnight(new Date()).getTime() + REST_DAY_DAYS_AHEAD * MS_PER_DAY);
  const name = day.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });
  const weekday = day.getUTCDay();

  const change = await planChangeFixture({
    kind: "edited",
    payload: {
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [weekday] }],
      source: "planEdit",
    },
    planId,
    reason: `${name}s are off.`,
    status: "proposed",
  });

  return { change, name, weekday };
}
