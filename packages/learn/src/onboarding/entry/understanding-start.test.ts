import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendGoal, takeSentGoal } from "./understanding-start";

function draftBeingRead(id: string): OnboardingDraftView {
  return {
    generationId: `wrun_${id}`,
    goalIds: [],
    id,
    prompt: "learn to cook for my family",
    status: "understanding",
    understanding: null,
  } as unknown as OnboardingDraftView;
}

describe(sendGoal, () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts the read and leaves following it to the draft's screen", async () => {
    const draft = draftBeingRead("draft-followed");
    const get = vi.fn(() => Promise.resolve(draft));
    const start = vi.fn(() => Promise.resolve({ draft, status: "started" as const }));
    // The screens pass their whole actions: reading the draft stays theirs, after its run ends.
    const understanding = { get, start };

    const sent = sendGoal({ goal: draft.prompt, language: "en", understanding });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(sent).resolves.toStrictEqual({ draft, status: "started" });
    expect(get).not.toHaveBeenCalled();
  });

  it("remembers the click that sent a running read, once", async () => {
    const draft = draftBeingRead("draft-sent");
    const start = vi.fn(() => Promise.resolve({ draft, status: "started" as const }));

    await sendGoal({ goal: draft.prompt, language: "en", understanding: { start } });

    expect(takeSentGoal(draft.id)).toStrictEqual(expect.any(Number));
    expect(takeSentGoal(draft.id)).toBeNull();
  });

  it("doesn't remember a read that couldn't start or a send left behind", async () => {
    const failed = draftBeingRead("draft-start-failed");
    const left = draftBeingRead("draft-left");
    const leaving = new AbortController();

    await sendGoal({
      goal: failed.prompt,
      language: "en",
      understanding: { start: () => Promise.resolve({ draft: failed, status: "startFailed" }) },
    });

    await sendGoal({
      goal: left.prompt,
      language: "en",
      signal: leaving.signal,
      understanding: {
        start: () => {
          leaving.abort();
          return Promise.resolve({ draft: left, status: "started" });
        },
      },
    });

    expect(takeSentGoal(failed.id)).toBeNull();
    expect(takeSentGoal(left.id)).toBeNull();
  });
});
