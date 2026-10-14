import { describe, expect, it } from "vitest";
import { type DraftSaveStatus, createDraftSaveQueue } from "./draft-save-queue";

type Draft = { answer: string; itemId: string };

/** A request the test answers when it wants: stored, refused, or not reached (rejects). */
type PendingSave = { draft: Draft; fail: () => void; refuse: () => void; store: () => void };

/** Lets every resolved promise run its callbacks before the test looks. */
function flushPromises() {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function setup() {
  const requests: PendingSave[] = [];
  const statuses: DraftSaveStatus[] = [];
  const retries: { ms: number; run: () => void }[] = [];

  const queue = createDraftSaveQueue<Draft>({
    keyOf: (draft) => draft.itemId,
    onStatus: (status) => statuses.push(status),
    save: (draft) =>
      new Promise<boolean>((resolve, reject) => {
        requests.push({
          draft,
          fail: () => reject(new Error("Failed to fetch")),
          refuse: () => resolve(false),
          store: () => resolve(true),
        });
      }),
    schedule: (run, ms) => {
      const retry = { ms, run };
      retries.push(retry);
      return () => retries.splice(retries.indexOf(retry), 1);
    },
  });

  return { queue, requests, retries, statuses };
}

describe(createDraftSaveQueue, () => {
  it("sends answers one after another, in the order they were given", async () => {
    const { queue, requests, statuses } = setup();

    queue.add({ answer: "B", itemId: "q1" });
    queue.add({ answer: "C", itemId: "q2" });

    expect(requests.map((request) => request.draft.itemId)).toStrictEqual(["q1"]);

    requests[0]?.store();
    await flushPromises();

    expect(requests.map((request) => request.draft.itemId)).toStrictEqual(["q1", "q2"]);

    requests[1]?.store();
    await flushPromises();

    expect(statuses.at(-1)).toBe("saved");
    expect(queue.isBusy()).toBe(false);
  });

  it("keeps saving every later answer after a request that didn't get through", async () => {
    const { queue, requests, retries, statuses } = setup();

    queue.add({ answer: "B", itemId: "q1" });
    requests[0]?.fail();
    await flushPromises();

    expect(statuses.at(-1)).toBe("retrying");

    // The learner keeps answering while the connection is down.
    queue.add({ answer: "D", itemId: "q2" });
    expect(requests).toHaveLength(1);

    retries[0]?.run();
    await flushPromises();

    expect(requests.map((request) => request.draft)).toStrictEqual([
      { answer: "B", itemId: "q1" },
      { answer: "B", itemId: "q1" },
    ]);

    requests[1]?.store();
    await flushPromises();
    requests[2]?.store();
    await flushPromises();

    expect(requests.map((request) => request.draft.itemId)).toStrictEqual(["q1", "q1", "q2"]);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("waits longer before each new try, and tries at once when asked", async () => {
    const { queue, requests, retries } = setup();

    queue.add({ answer: "B", itemId: "q1" });
    requests[0]?.fail();
    await flushPromises();
    retries[0]?.run();
    await flushPromises();
    requests[1]?.fail();
    await flushPromises();

    expect(retries.map((retry) => retry.ms)).toStrictEqual([1000, 2000]);

    queue.retryNow();
    await flushPromises();

    expect(retries).toHaveLength(1);
    expect(requests).toHaveLength(3);
  });

  it("sends only the newest answer to a question still waiting to go out", async () => {
    const { queue, requests } = setup();

    queue.add({ answer: "A", itemId: "q1" });
    queue.add({ answer: "B", itemId: "q2" });
    queue.add({ answer: "C", itemId: "q2" });

    requests[0]?.store();
    await flushPromises();

    expect(requests.map((request) => request.draft)).toStrictEqual([
      { answer: "A", itemId: "q1" },
      { answer: "C", itemId: "q2" },
    ]);
  });

  it("doesn't send an answer again once a newer one to its question replaced it", async () => {
    const { queue, requests, retries } = setup();

    queue.add({ answer: "A", itemId: "q1" });
    queue.add({ answer: "B", itemId: "q1" });
    requests[0]?.fail();
    await flushPromises();
    retries[0]?.run();
    await flushPromises();

    expect(requests.map((request) => request.draft.answer)).toStrictEqual(["A", "B"]);
  });

  it("says when the server refused an answer, until a later one is stored", async () => {
    const { queue, requests, retries, statuses } = setup();

    queue.add({ answer: "B", itemId: "q1" });
    requests[0]?.refuse();
    await flushPromises();

    // Refused isn't tried again: it would be refused again.
    expect(statuses.at(-1)).toBe("refused");
    expect(retries).toHaveLength(0);

    queue.add({ answer: "C", itemId: "q2" });
    requests[1]?.store();
    await flushPromises();

    expect(statuses.at(-1)).toBe("saved");
  });

  it("lets a hand-in wait until every answer is stored, retries included", async () => {
    const { queue, requests, retries } = setup();
    let idle = false;

    queue.add({ answer: "B", itemId: "q1" });

    void queue.idle().then(() => {
      idle = true;
    });

    requests[0]?.fail();
    await flushPromises();
    expect(idle).toBe(false);

    retries[0]?.run();
    await flushPromises();
    requests[1]?.store();
    await flushPromises();

    expect(idle).toBe(true);
    await expect(queue.idle()).resolves.toBeUndefined();
  });
});
