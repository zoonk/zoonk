import { requestWithin } from "../../plan/use-time-to-cover";

type Sent<Answer> = { answer: Promise<Answer>; key: string };

/**
 * One request out at a time: asking again for the `key` that's out joins it, and asking for another
 * waits until it settles, so one whose `signal` aborts meanwhile is never sent. An asker hears null
 * once a request is too slow to wait for, but the lane stays held until that request settles.
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

  return async function askInTurn(asked: {
    key: string;
    request: () => Promise<Answer>;
    signal: AbortSignal;
  }): Promise<Answer | null> {
    const { key, request, signal } = asked;

    if (out && out.key !== key) {
      await out.answer.catch(() => null);
      return askInTurn(asked);
    }

    if (signal.aborted) {
      return null;
    }

    const sent = out?.key === key ? out : send(key, request);
    return requestWithin(() => sent.answer);
  };
}
