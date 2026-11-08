import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guest: vi.fn(async () => ({ learnerId: "learner", status: "ready" })),
  here: true,
  send: vi.fn<typeof fetch>(),
}));

vi.mock("@/lib/guest/ensure-guest-session", () => ({ ensureGuestSession: mocks.guest }));
vi.mock("@/lib/session/tap-answer", () => ({ stayingHere: () => async () => mocks.here }));

const OPENING = {
  target: { blockId: "289775ed-1f10-4589-9c4d-e429b219deaa", kind: "block" as const },
};

const LESSON = "766616a9-d57d-40b3-891f-067742f5837e";

async function startModule() {
  return import("@/app/[lang]/learn/[lessonId]/start-library-lesson");
}

describe("the lesson adapter's study-start policy", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.here = true;
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
    vi.stubGlobal("fetch", mocks.send);

    mocks.send.mockImplementation(async () =>
      Response.json({ opening: { kind: "today" }, status: "opened" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("holds the whole request until activation and sends the exact opening once", async () => {
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: false } });
    const events = new EventTarget();
    vi.stubGlobal("addEventListener", events.addEventListener.bind(events));
    vi.stubGlobal("removeEventListener", events.removeEventListener.bind(events));
    const { startLibraryLesson } = await startModule();
    const onOpened = vi.fn();

    const pending = startLibraryLesson({
      lessonId: LESSON,
      onOpened,
      opening: OPENING,
      studySessionId: null,
    });

    await Promise.resolve();
    expect(mocks.guest).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    events.dispatchEvent(new Event("pointerdown"));
    await expect(pending).resolves.toStrictEqual({ reason: "opened" });
    expect(mocks.send).toHaveBeenCalledOnce();
    const sentBody = mocks.send.mock.calls[0]?.[1]?.body;

    if (typeof sentBody !== "string") {
      throw new TypeError("Expected the JSON start body");
    }

    const body: unknown = JSON.parse(sentBody);
    expect(body).toMatchObject({ opening: OPENING });
    expect(onOpened).toHaveBeenCalledExactlyOnceWith({ kind: "today" });
  });

  it("does not apply an alternative opening after the originating navigation ends", async () => {
    const { startLibraryLesson } = await startModule();
    const onOpened = vi.fn();

    mocks.send.mockImplementation(async () => {
      mocks.here = false;
      return Response.json({ opening: { kind: "today" }, status: "opened" });
    });

    await expect(
      startLibraryLesson({ lessonId: LESSON, onOpened, opening: OPENING, studySessionId: null }),
    ).resolves.toStrictEqual({ reason: "failed" });

    expect(onOpened).not.toHaveBeenCalled();
  });

  it("never falls back to a standalone request for malformed URL intent", async () => {
    const { startLibraryLesson } = await startModule();

    await expect(
      startLibraryLesson({ lessonId: LESSON, opening: "invalid", studySessionId: null }),
    ).resolves.toStrictEqual({ reason: "notFound" });

    expect(mocks.guest).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
