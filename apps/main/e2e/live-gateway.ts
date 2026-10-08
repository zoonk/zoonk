import { type Page } from "@playwright/test";
import { z } from "zod";

/** Where the browser opens a call: GPT-Live's Live WebSocket on AI Gateway. */
const LIVE_SESSIONS_URL = "wss://ai-gateway.vercel.sh/v1/live/sessions";

/** How long each fake line takes on the session's timeline. */
const LINE_MS = 800;

/** What the character says to a reply the learner typed. */
export const CHARACTER_REPLY = "Yes, it's still available.";

/** What the character asks when it's told the learner has been quiet. */
export const CHARACTER_CHECK_IN = "Hello? Are you still there?";

const liveEventSchema = z.object({ content: z.string().optional(), type: z.string() });

function readEvent(message: string | Buffer) {
  if (typeof message !== "string") {
    return null;
  }

  const parsed = liveEventSchema.safeParse(JSON.parse(message));
  return parsed.success ? parsed.data : null;
}

/**
 * Stands in for GPT-Live, since tests never reach it (the server hands out a stand-in token):
 * `answers` starts the session, says the opening line it's told to, answers each typed reply,
 * checks in when told the learner is quiet and confirms the close; `drops` answers the first typed reply, then loses the connection; `silent`
 * accepts the connection and never starts the session, like a call that doesn't connect.
 * `asked` settles once the browser asks to start a session.
 */
export async function answerLiveCalls(page: Page, gateway: "answers" | "drops" | "silent") {
  const asked = Promise.withResolvers<null>();

  await page.routeWebSocket(LIVE_SESSIONS_URL, (ws) => {
    const timeline = { ms: 0 };

    const say = (text: string) => {
      const startMs = timeline.ms;
      timeline.ms += LINE_MS;

      ws.send(
        JSON.stringify({
          delta: ` ${text}`,
          end_ms: timeline.ms,
          start_ms: startMs,
          type: "session.output_transcript.delta",
        }),
      );
    };

    ws.onMessage((message) => {
      const event = readEvent(message);

      if (event?.type === "session.start") {
        asked.resolve(null);
      }

      if (gateway === "silent" || !event) {
        return;
      }

      if (event.type === "session.start") {
        ws.send(JSON.stringify({ session: { id: "live_e2e" }, type: "session.started" }));
      }

      if (event.type === "session.instructions.append" && event.content?.includes("opening line")) {
        say("Hi! Are you calling about the apartment?");
      }

      if (event.type === "session.instructions.append" && event.content?.includes("quiet")) {
        say(CHARACTER_CHECK_IN);
      }

      if (event.type === "session.instructions.append" && event.content?.includes("typed")) {
        say(CHARACTER_REPLY);

        if (gateway === "drops") {
          void ws.close({ code: 1011, reason: "Lost" });
        }
      }

      if (event.type === "session.close") {
        ws.send(
          JSON.stringify({
            reason: "close_requested",
            session: { id: "live_e2e" },
            type: "session.closed",
            usage: { seconds: timeline.ms / 1000 },
          }),
        );
      }
    });
  });

  return { asked: asked.promise };
}
