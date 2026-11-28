import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { RetainedLesson } from "../_test-utils/retained-lesson";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { spokenAnswerStep } from "../preview/preview-steps";

class TestRecorder extends EventTarget {
  static instances: TestRecorder[] = [];
  static startError = false;
  static holdStart = false;
  static isTypeSupported = () => true;
  mimeType = "audio/webm";
  state = "inactive";
  start = vi.fn(() => {
    if (TestRecorder.startError) {
      throw new DOMException("Encoder unavailable", "NotSupportedError");
    }

    this.state = "recording";

    if (!TestRecorder.holdStart) {
      queueMicrotask(() => this.dispatchEvent(new Event("start")));
    }
  });
  stop = vi.fn(() => {
    this.state = "inactive";
  });

  constructor() {
    super();
    TestRecorder.instances.push(this);
  }

  finish() {
    this.dispatchEvent(new BlobEvent("dataavailable", { data: new Blob(["voice"]) }));
    this.dispatchEvent(new Event("stop"));
  }
}

function microphone() {
  const audio = new AudioContext();
  onTestFinished(() => audio.close());
  const { stream } = audio.createMediaStreamDestination();
  const [track] = stream.getAudioTracks();

  if (!track) {
    throw new Error("The audio destination has no microphone track");
  }

  const stop = vi.spyOn(track, "stop");

  return { stop, stream, track };
}

function cue() {
  return document.querySelector("[data-slot=record-cue]")?.textContent;
}

function openRecorder({ retained = false }: { retained?: boolean } = {}) {
  TestRecorder.instances = [];
  TestRecorder.startError = false;
  TestRecorder.holdStart = false;
  vi.stubGlobal("MediaRecorder", TestRecorder);
  const lesson = buildLesson([spokenAnswerStep()]);

  const gradeSpokenAnswer = vi.fn<NonNullable<LessonPlayerAdapters["gradeSpokenAnswer"]>>(
    async () => ({ status: "noSpeech" }),
  );

  return {
    ...renderLessonPlayer({
      adapters: buildAdapters(lesson, { gradeSpokenAnswer }),
      children: retained ? <RetainedLesson /> : undefined,
      lesson,
    }),
    gradeSpokenAnswer,
  };
}

describe("recorder ownership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("opens the microphone only on Record, and invites speech only once the recorder starts", async () => {
    const mic = microphone();

    // The recorder must go live even when the browser can't build its meter.
    vi.spyOn(AudioContext.prototype, "createMediaStreamSource").mockImplementation(() => {
      throw new DOMException("Meter unavailable", "NotSupportedError");
    });

    const getUserMedia = vi
      .spyOn(navigator.mediaDevices, "getUserMedia")
      .mockResolvedValue(mic.stream);

    openRecorder();
    TestRecorder.holdStart = true;
    const record = page.getByRole("button", { exact: true, name: "Record" });
    await expect.element(record).toBeVisible();
    expect(getUserMedia).not.toHaveBeenCalled();

    await record.click();
    await expect.poll(() => cue()).toBe("Getting ready…");
    await expect.element(record).toHaveAttribute("aria-busy", "true");
    await expect.element(page.getByRole("button", { name: /^Stop/u })).not.toBeInTheDocument();

    act(() => {
      TestRecorder.instances[0]?.dispatchEvent(new Event("start"));
    });

    await expect.poll(() => cue()).toBe("Speak now");
    await expect.element(page.getByRole("button", { name: /^Stop/u })).toBeVisible();
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it("waits for a muted microphone to unmute before inviting speech", async () => {
    const mic = microphone();
    const muted = vi.spyOn(mic.track, "muted", "get").mockReturnValue(true);
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(mic.stream);
    openRecorder();

    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await expect.poll(() => TestRecorder.instances[0]?.start.mock.calls.length).toBe(1);
    await expect.poll(() => cue()).toBe("Getting ready…");

    act(() => {
      muted.mockReturnValue(false);
      mic.track.dispatchEvent(new Event("unmute"));
    });

    await expect.poll(() => cue()).toBe("Speak now");
  });

  it("sends the time from the press to the recorder going live", async () => {
    const mic = microphone();
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(mic.stream);
    const view = openRecorder();
    TestRecorder.holdStart = true;
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await expect.poll(() => TestRecorder.instances.length).toBe(1);
    now.mockReturnValue(1430);

    act(() => {
      TestRecorder.instances[0]?.dispatchEvent(new Event("start"));
    });

    await page.getByRole("button", { name: /^Stop/u }).click();
    act(() => TestRecorder.instances[0]?.finish());
    await expect.poll(() => view.gradeSpokenAnswer.mock.calls.length).toBe(1);
    expect(view.gradeSpokenAnswer.mock.calls[0]?.[0].micStartupMs).toBe(430);
  });

  it("a retained owner can record again while its abandoned permission request is pending", async () => {
    const permission = Promise.withResolvers<MediaStream>();
    const abandoned = microphone();
    const current = microphone();

    const getUserMedia = vi
      .spyOn(navigator.mediaDevices, "getUserMedia")
      .mockReturnValueOnce(permission.promise)
      .mockResolvedValueOnce(current.stream);

    const view = openRecorder({ retained: true });
    const record = page.getByRole("button", { exact: true, name: "Record" });
    await record.click();
    await expect.element(record).toBeDisabled();
    await page.getByRole("button", { name: "Hide lesson" }).click();
    await page.getByRole("button", { name: "Show lesson" }).click();
    await expect.element(record).toBeEnabled();
    await record.click();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    await expect.element(page.getByRole("button", { name: /^Stop/u })).toBeVisible();

    await act(async () => {
      permission.resolve(abandoned.stream);
      await permission.promise;
    });

    expect(abandoned.stop).toHaveBeenCalledOnce();
    expect(current.stop).not.toHaveBeenCalled();
    expect(TestRecorder.instances).toHaveLength(1);
    await page.getByRole("button", { name: /^Stop/u }).click();
    expect(current.stop).toHaveBeenCalledOnce();
    act(() => TestRecorder.instances[0]?.finish());
    await expect.poll(() => view.gradeSpokenAnswer.mock.calls.length).toBe(1);
    await expect.element(record).toBeEnabled();
  });

  it("a retained recording returns idle, without its elapsed time or late stop submitting", async () => {
    const abandoned = microphone();
    const current = microphone();

    vi.spyOn(navigator.mediaDevices, "getUserMedia")
      .mockResolvedValueOnce(abandoned.stream)
      .mockResolvedValueOnce(current.stream);

    const view = openRecorder({ retained: true });

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });

    const now = vi.spyOn(Date, "now").mockReturnValue(0);

    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await expect.element(page.getByRole("button", { name: /^Stop/u })).toBeVisible();
    now.mockReturnValue(10_000);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await expect.element(page.getByText("0:10", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hide lesson" }).click();
    expect(abandoned.stop).toHaveBeenCalledOnce();
    expect(TestRecorder.instances[0]?.stop).toHaveBeenCalledOnce();
    await page.getByRole("button", { name: "Show lesson" }).click();
    const record = page.getByRole("button", { exact: true, name: "Record" });
    await expect.element(record).toBeEnabled();
    await record.click();
    await expect.element(page.getByText("0:00", { exact: true })).toBeVisible();
    act(() => TestRecorder.instances[0]?.finish());
    expect(view.gradeSpokenAnswer).not.toHaveBeenCalled();
    expect(current.stop).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(TestRecorder.instances[1]?.stop).not.toHaveBeenCalled();
    await page.getByRole("button", { name: /^Stop/u }).click();
    expect(current.stop).toHaveBeenCalledOnce();
    act(() => TestRecorder.instances[1]?.finish());
    await expect.poll(() => view.gradeSpokenAnswer.mock.calls.length).toBe(1);
    await expect.element(record).toBeEnabled();
  });

  it("releases the stream when the browser cannot start its recorder", async () => {
    const mic = microphone();
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(mic.stream);
    const view = openRecorder();

    TestRecorder.startError = true;
    await page.getByRole("button", { exact: true, name: "Record" }).click();

    await expect
      .element(page.getByText("We can't use your microphone, so type what you'd say."))
      .toBeVisible();

    expect(mic.stop).toHaveBeenCalledOnce();
    expect(view.gradeSpokenAnswer).not.toHaveBeenCalled();
  });

  it("acquires once when Record is pressed twice before permission resolves", async () => {
    const permission = Promise.withResolvers<MediaStream>();

    const getUserMedia = vi
      .spyOn(navigator.mediaDevices, "getUserMedia")
      .mockReturnValue(permission.promise);

    openRecorder();
    const record = page.getByRole("button", { exact: true, name: "Record" });
    await expect.element(record).toBeVisible();

    act(() => {
      (record.element() as HTMLButtonElement).click();
      (record.element() as HTMLButtonElement).click();
    });

    expect(getUserMedia).toHaveBeenCalledOnce();
    const mic = microphone();

    await act(async () => {
      permission.resolve(mic.stream);
      await permission.promise;
    });

    expect(TestRecorder.instances).toHaveLength(1);
    await expect.element(page.getByRole("button", { name: /^Stop/u })).toBeVisible();
  });

  it("releases permission granted after leaving, without starting or submitting", async () => {
    const permission = Promise.withResolvers<MediaStream>();
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockReturnValue(permission.promise);
    const view = openRecorder();
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    view.unmount();
    const mic = microphone();

    await act(async () => {
      permission.resolve(mic.stream);
      await permission.promise;
    });

    expect(mic.stop).toHaveBeenCalledOnce();
    expect(TestRecorder.instances).toHaveLength(0);
    expect(view.gradeSpokenAnswer).not.toHaveBeenCalled();
  });

  it("Stop releases its microphone immediately, and its old deadline cannot stop a new recording", async () => {
    const first = microphone();
    const second = microphone();

    vi.spyOn(navigator.mediaDevices, "getUserMedia")
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);

    openRecorder();

    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });

    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await page.getByRole("button", { name: /^Stop/u }).click();
    expect(first.stop).toHaveBeenCalledOnce();
    act(() => TestRecorder.instances[0]?.finish());
    await expect.element(page.getByRole("button", { exact: true, name: "Record" })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(TestRecorder.instances[1]?.stop).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(TestRecorder.instances[1]?.stop).toHaveBeenCalledOnce();
    expect(second.stop).toHaveBeenCalledOnce();
  });

  it("leaving an active recording stops its recorder, tracks and deadline without submitting", async () => {
    const mic = microphone();
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(mic.stream);
    const view = openRecorder();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    view.unmount();
    expect(TestRecorder.instances[0]?.stop).toHaveBeenCalledOnce();
    expect(mic.stop).toHaveBeenCalledOnce();
    act(() => TestRecorder.instances[0]?.finish());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(TestRecorder.instances[0]?.stop).toHaveBeenCalledOnce();
    expect(view.gradeSpokenAnswer).not.toHaveBeenCalled();
  });
});
