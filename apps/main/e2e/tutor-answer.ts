import { type Route } from "@playwright/test";

function uiMessageEvent(event: object) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Answers a tutor question with `answer`, streamed like the API does (an AI SDK UI message stream). */
export function fulfillTutorAnswer(route: Route, answer: string) {
  return route.fulfill({
    body: [
      uiMessageEvent({ type: "start" }),
      uiMessageEvent({ id: "answer", type: "text-start" }),
      uiMessageEvent({ delta: answer, id: "answer", type: "text-delta" }),
      uiMessageEvent({ id: "answer", type: "text-end" }),
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
