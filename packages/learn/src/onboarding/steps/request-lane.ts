import { requestWithin } from "../../plan/request-within";

type Asked<Answer> = { key: string; request: () => Promise<Answer>; signal: AbortSignal };

type Sent<Answer> = { answer: Promise<Answer>; key: string };

/**
 * One request out at a time: asking again for the `key` that's out joins it, and asking for another
 * waits until it settles, so one whose `signal` aborts meanwhile is never sent. An asker hears null
 * once it has waited too long since asking, queued or not, but the lane stays held until the request
 * out settles. Each polling round keeps its unanswered request until a poll receives the result.
 */
export function createRequestLane<Answer>() {
  let pending: (Sent<Answer | null> & { signal: AbortSignal }) | null = null;
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

  return async function askInTurn(asked: Asked<Answer>): Promise<Answer | null> {
    const { key, signal } = asked;

    const sent =
      pending?.signal === signal && pending.key === key
        ? pending
        : { answer: sendInTurn(asked), key, signal };

    pending = sent;

    const result = await requestWithin(() => sent.answer);

    if (result.status === "timedOut") {
      return null;
    }

    if (pending === sent) {
      pending = null;
    }

    return signal.aborted ? null : result.value;
  };
}
