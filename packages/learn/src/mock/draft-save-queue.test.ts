import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type DraftSaveStatus, createDraftSaveQueue } from "./draft-save-queue";

type Draft = { answer: string; itemId: string };

type PendingSave = { draft: Draft; fail: () => void; refuse: () => void; store: () => void };

function flushPromises() {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function setup() {
  const requests: PendingSave[] = [];
  const statuses: DraftSaveStatus[] = [];

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
  });

  return { queue, requests, statuses };
}

describe(createDraftSaveQueue, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    const { queue, requests, statuses } = setup();

    queue.add({ answer: "B", itemId: "q1" });
    requests[0]?.fail();
    await flushPromises();

    expect(statuses.at(-1)).toBe("retrying");

    queue.add({ answer: "D", itemId: "q2" });
    expect(requests).toHaveLength(1);

    vi.runOnlyPendingTimers();
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
    const { queue, requests } = setup();

    queue.add({ answer: "B", itemId: "q1" });
    requests[0]?.fail();
    await flushPromises();
    vi.advanceTimersByTime(999);
    expect(requests).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(2);

    requests[1]?.fail();
    await flushPromises();
    vi.advanceTimersByTime(1999);
    expect(requests).toHaveLength(2);

    queue.retryNow();
    await flushPromises();

    expect(vi.getTimerCount()).toBe(0);
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
    const { queue, requests } = setup();

    queue.add({ answer: "A", itemId: "q1" });
    queue.add({ answer: "B", itemId: "q1" });
    requests[0]?.fail();
    await flushPromises();
    vi.runOnlyPendingTimers();
    await flushPromises();

    expect(requests.map((request) => request.draft.answer)).toStrictEqual(["A", "B"]);
  });

  it("says when the server refused an answer, until a later one is stored", async () => {
    const { queue, requests, statuses } = setup();

    queue.add({ answer: "B", itemId: "q1" });
    requests[0]?.refuse();
    await flushPromises();

    expect(statuses.at(-1)).toBe("refused");
    expect(vi.getTimerCount()).toBe(0);

    queue.add({ answer: "C", itemId: "q2" });
    requests[1]?.store();
    await flushPromises();

    expect(statuses.at(-1)).toBe("saved");
  });

  it("lets a hand-in wait until every answer is stored, retries included", async () => {
    const { queue, requests } = setup();
    let idle = false;

    queue.add({ answer: "B", itemId: "q1" });

    void queue.idle().then(() => {
      idle = true;
    });

    requests[0]?.fail();
    await flushPromises();
    expect(idle).toBe(false);

    vi.runOnlyPendingTimers();
    await flushPromises();
    requests[1]?.store();
    await flushPromises();

    expect(idle).toBe(true);
    await expect(queue.idle()).resolves.toBeUndefined();
  });
});
