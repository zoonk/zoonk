/**
 * One request out at a time: a request asked while another is out waits its turn, and one whose
 * `signal` aborts while it waits is never sent, so of the requests asked meanwhile only the latest
 * goes.
 */
export function createRequestLane() {
  let out: Promise<unknown> | null = null;

  async function waitTurn(): Promise<void> {
    const turn = out;
    await turn;

    if (turn !== out) {
      await waitTurn();
    }
  }

  return async function askInTurn<Answer>({
    request,
    signal,
  }: {
    request: () => Promise<Answer>;
    signal: AbortSignal;
  }): Promise<Answer | null> {
    if (out) {
      await waitTurn();
    }

    if (signal.aborted) {
      return null;
    }

    const answer = request();
    out = answer.catch(() => null);
    return answer;
  };
}
