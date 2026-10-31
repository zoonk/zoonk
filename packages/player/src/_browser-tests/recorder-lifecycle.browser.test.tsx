import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { RetainedLesson } from "../_test-utils/retained-lesson";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { spokenAnswerStep } from "../preview/preview-steps";

class TestRecorder extends EventTarget {
  static instances: TestRecorder[] = [];
  static startError = false;
  static isTypeSupported = () => true;
  mimeType = "audio/webm";
  state = "inactive";
  start = vi.fn(() => {
    if (TestRecorder.startError) {
      throw new DOMException("Encoder unavailable", "NotSupportedError");
    }

    this.state = "recording";
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
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}

function openRecorder({ retained = false }: { retained?: boolean } = {}) {
  TestRecorder.instances = [];
  TestRecorder.startError = false;
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

    expect(abandoned.track.stop).toHaveBeenCalledOnce();
    expect(current.track.stop).not.toHaveBeenCalled();
    expect(TestRecorder.instances).toHaveLength(1);
    await page.getByRole("button", { name: /^Stop/u }).click();
    expect(current.track.stop).toHaveBeenCalledOnce();
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
    expect(abandoned.track.stop).toHaveBeenCalledOnce();
    expect(TestRecorder.instances[0]?.stop).toHaveBeenCalledOnce();
    await page.getByRole("button", { name: "Show lesson" }).click();
    const record = page.getByRole("button", { exact: true, name: "Record" });
    await expect.element(record).toBeEnabled();
    await record.click();
    await expect.element(page.getByText("0:00", { exact: true })).toBeVisible();
    act(() => TestRecorder.instances[0]?.finish());
    expect(view.gradeSpokenAnswer).not.toHaveBeenCalled();
    expect(current.track.stop).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(TestRecorder.instances[1]?.stop).not.toHaveBeenCalled();
    await page.getByRole("button", { name: /^Stop/u }).click();
    expect(current.track.stop).toHaveBeenCalledOnce();
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
      .element(page.getByText("The microphone is blocked. Type your answer instead."))
      .toBeVisible();

    expect(mic.track.stop).toHaveBeenCalledOnce();
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

    expect(mic.track.stop).toHaveBeenCalledOnce();
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
    expect(first.track.stop).toHaveBeenCalledOnce();
    act(() => TestRecorder.instances[0]?.finish());
    await expect.element(page.getByRole("button", { exact: true, name: "Record" })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(TestRecorder.instances[1]?.stop).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(TestRecorder.instances[1]?.stop).toHaveBeenCalledOnce();
    expect(second.track.stop).toHaveBeenCalledOnce();
  });

  it("leaving an active recording stops its recorder, tracks and deadline without submitting", async () => {
    const mic = microphone();
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(mic.stream);
    const view = openRecorder();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    view.unmount();
    expect(TestRecorder.instances[0]?.stop).toHaveBeenCalledOnce();
    expect(mic.track.stop).toHaveBeenCalledOnce();
    act(() => TestRecorder.instances[0]?.finish());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(TestRecorder.instances[0]?.stop).toHaveBeenCalledOnce();
    expect(view.gradeSpokenAnswer).not.toHaveBeenCalled();
  });
});
