import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { toggleSave } from "./tab-saves";

const settled = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const failing = () => Promise.resolve(null);

/** A server that stores each request as it's sent, and answers it only when the test says. */
function server() {
  const out: (() => void)[] = [];
  const sent: boolean[] = [];

  return {
    answerNewest: async () => {
      out.pop()?.();
      await settled();
    },
    out,
    send: (saved: boolean) => {
      sent.push(saved);

      return new Promise<boolean | null>((resolve) => {
        out.push(() => resolve(saved));
      });
    },
    sent,
  };
}

/** A tap in `tab` on a page that was served `served`, and what that page is told of how it ended. */
function tap({
  key,
  send,
  served,
  tab = { toggleSave },
}: {
  key: string;
  send: (saved: boolean) => Promise<boolean | null>;
  served: boolean;
  tab?: { toggleSave: typeof toggleSave };
}) {
  const failed: boolean[] = [];

  tab.toggleSave(key, {
    onFailed: (saved) => failed.push(saved),
    onStored: () => {},
    send,
    served,
  });

  return { failed };
}

describe(toggleSave, () => {
  it("keeps a removal made on another page when the save before it answers late", async () => {
    const key = randomUUID();
    const api = server();

    tap({ key, send: api.send, served: false });
    tap({ key, send: api.send, served: true });

    expect(api.out).toHaveLength(1);

    await api.answerNewest();
    await api.answerNewest();

    tap({ key, send: api.send, served: false });

    expect(api.sent).toStrictEqual([true, false, true]);
  });

  it("tells the page of the newest tap when a request fails", async () => {
    const key = randomUUID();
    const completed = tap({ key, send: failing, served: false });
    const player = tap({ key, send: failing, served: true });

    await settled();

    expect(completed.failed).toStrictEqual([]);
    expect(player.failed).toStrictEqual([false]);
  });

  it("takes another tab's removal of a save made here, so the next tap saves it again", async () => {
    const key = randomUUID();
    const api = server();
    vi.resetModules();
    const otherTab = await import("./tab-saves");

    tap({ key, send: api.send, served: false });
    await api.answerNewest();

    tap({ key, send: api.send, served: true, tab: otherTab });
    await api.answerNewest();

    tap({ key, send: api.send, served: false });

    expect(api.sent).toStrictEqual([true, false, true]);
  });
});
