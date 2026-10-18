import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetSentGoal,
  getSentGoal,
  holdSentGoal,
  sendGoal,
  takeSentGoal,
} from "./understanding-start";

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

  it("keeps the sent words for the loading bridge without consuming the click", async () => {
    const draft = draftBeingRead("draft-bridge");

    await sendGoal({
      goal: draft.prompt,
      language: "en",
      understanding: { start: () => Promise.resolve({ draft, status: "started" }) },
    });

    expect(getSentGoal(draft.id)).toStrictEqual({
      pending: true,
      prompt: draft.prompt,
      sentAt: expect.any(Number),
    });

    expect(getSentGoal(draft.id)).not.toBeNull();
    expect(takeSentGoal(draft.id)).toStrictEqual(expect.any(Number));
    expect(getSentGoal(draft.id)).toBeNull();
  });

  it("preserves the click through a StrictMode cleanup replay, then revokes it on departure", async () => {
    const draft = draftBeingRead("draft-replayed");

    await sendGoal({
      goal: draft.prompt,
      language: "en",
      understanding: { start: () => Promise.resolve({ draft, status: "started" }) },
    });

    const releaseFirst = holdSentGoal(draft.id);
    releaseFirst();
    const releaseReplay = holdSentGoal(draft.id);
    await Promise.resolve();
    expect(getSentGoal(draft.id)).not.toBeNull();

    releaseReplay();
    await Promise.resolve();
    expect(getSentGoal(draft.id)).toBeNull();
  });

  it("doesn't promise a pending wait for an already-read draft", async () => {
    const draft = { ...draftBeingRead("draft-read"), status: "understood" as const };

    await sendGoal({
      goal: draft.prompt,
      language: "en",
      understanding: { start: () => Promise.resolve({ draft, status: "started" }) },
    });

    expect(getSentGoal(draft.id)?.pending).toBe(false);
    forgetSentGoal(draft.id);
  });

  it("revokes a continuation canceled after the start response, without canceling its replacement", async () => {
    const oldDraft = draftBeingRead("draft-canceled");
    const nextDraft = draftBeingRead("draft-replacement");

    await sendGoal({
      goal: oldDraft.prompt,
      language: "en",
      understanding: { start: () => Promise.resolve({ draft: oldDraft, status: "started" }) },
    });

    forgetSentGoal(oldDraft.id);

    await sendGoal({
      goal: nextDraft.prompt,
      language: "en",
      understanding: { start: () => Promise.resolve({ draft: nextDraft, status: "started" }) },
    });

    expect(takeSentGoal(oldDraft.id)).toBeNull();
    expect(takeSentGoal(nextDraft.id)).toStrictEqual(expect.any(Number));
  });

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
