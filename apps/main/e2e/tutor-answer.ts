import { type Route } from "@playwright/test";
import { anyPlanOperationSchema } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
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
