import { requestWithin } from "../../plan/use-time-to-cover";

type Asked<Answer> = { key: string; request: () => Promise<Answer>; signal: AbortSignal };

type Sent<Answer> = { answer: Promise<Answer>; key: string };

/**
 * One request out at a time: asking again for the `key` that's out joins it, and asking for another
 * waits until it settles, so one whose `signal` aborts meanwhile is never sent. An asker hears null
 * once it has waited too long since asking, queued or not, but the lane stays held until the request
 * out settles.
 */
export function createRequestLane<Answer>() {
  let out: Sent<Answer> | null = null;

  function send(key: string, request: () => Promise<Answer>): Sent<Answer> {
    const sent = { answer: request(), key };
    out = sent;

    void sent.answer
      .catch(() => null)
      .finally(() => {
        if (out === sent) {
          out = null;
        }
      });

    return sent;
  }

  async function sendInTurn(asked: Asked<Answer>): Promise<Answer | null> {
    const { key, request, signal } = asked;

    if (out && out.key !== key) {
      await out.answer.catch(() => null);
      return sendInTurn(asked);
    }

    if (signal.aborted) {
      return null;
    }

    return (out?.key === key ? out : send(key, request)).answer;
  }

  return function askInTurn(asked: Asked<Answer>): Promise<Answer | null> {
    return requestWithin(() => sendInTurn(asked));
  };
}
