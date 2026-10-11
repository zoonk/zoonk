import { render } from "@testing-library/react";
import { ListeningPlayer } from "@zoonk/learn/listening/player";
import { ListeningStimulus } from "@zoonk/learn/listening/stimulus";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

/**
 * A listening exam's recording plays the way the exam plays it: once or twice, from start to end
 * with no pause, and nothing after the last play. A play counts once the sound starts, so one that
 * fails to load costs nothing. In review, the recording plays and pauses freely.
 */

const SAMPLE_RATE = 8000;
const WAV_HEADER_BYTES = 44;
const TONE_HZ = 440;
const AMPLITUDE = 8000;

/** Long enough for a recording to play to its end. */
const PLAY_TIMEOUT = 5000;

/** A short tone as a WAV data URL: a real recording the browser plays to its end. */
function toneUrl(seconds: number): string {
  const samples = Math.round(SAMPLE_RATE * seconds);
  const bytes = new Uint8Array(WAV_HEADER_BYTES + samples * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => bytes.set(new TextEncoder().encode(text), offset);

  write(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);

  for (let index = 0; index < samples; index += 1) {
    const value = Math.sin((2 * Math.PI * TONE_HZ * index) / SAMPLE_RATE) * AMPLITUDE;
    view.setInt16(WAV_HEADER_BYTES + index * 2, Math.round(value), true);
  }

  return `data:audio/wav;base64,${btoa(String.fromCodePoint(...bytes))}`;
}

/** The player as a mock or practice holds it: the parent keeps how many plays were used. */
function Recording({
  onPlayed,
  played: initial = 0,
  plays,
  url = toneUrl(0.4),
}: {
  onPlayed: () => void;
  played?: number;
  plays: number | null;
  url?: string;
}) {
  const [played, setPlayed] = useState(initial);

  return (
    <ListeningPlayer
      durationMs={400}
      onPlayed={() => {
        onPlayed();
        setPlayed((count) => count + 1);
      }}
      played={played}
      plays={plays}
      title="Booking a hall"
      url={url}
    />
  );
}

const recording = () => page.getByRole("region", { name: "Recording" });

describe("listening recordings", () => {
  it("plays twice, never pausing, then has nothing left to play", async () => {
    const onPlayed = vi.fn();
    render(<Recording onPlayed={onPlayed} plays={2} url={toneUrl(1.2)} />);

    await expect.element(recording().getByText("Booking a hall")).toBeVisible();
    await expect.element(page.getByText(/You hear it twice, like in the exam/u)).toBeVisible();

    await page.getByRole("button", { name: "Play the recording" }).click();

    // While it plays there is no pause: the one button waits for the end.
    await expect
      .element(page.getByText("Playing. It doesn't pause, like in the exam."))
      .toBeVisible();

    await expect.element(page.getByRole("button", { name: "Playing" })).toBeDisabled();
    expect(onPlayed).toHaveBeenCalledOnce();

    await expect
      .element(page.getByText("You can listen one more time."), { timeout: PLAY_TIMEOUT })
      .toBeVisible();

    await page.getByRole("button", { name: "Play it again" }).click();

    await expect
      .element(page.getByText("You've used every play. Answer from what you heard."), {
        timeout: PLAY_TIMEOUT,
      })
      .toBeVisible();

    await expect.element(page.getByRole("button", { name: "Play it again" })).toBeDisabled();
    expect(onPlayed).toHaveBeenCalledTimes(2);
  });

  it("keeps the plays already used, so coming back doesn't give them back", async () => {
    render(<Recording onPlayed={vi.fn()} played={1} plays={1} />);

    await expect
      .element(page.getByText("You've used every play. Answer from what you heard."))
      .toBeVisible();

    await expect.element(page.getByRole("button", { name: "Play it again" })).toBeDisabled();
  });

  it("costs no play when the recording doesn't load, and can be tried again", async () => {
    const onPlayed = vi.fn();
    render(<Recording onPlayed={onPlayed} plays={1} url="/missing-recording.mp3" />);

    await page.getByRole("button", { name: "Play the recording" }).click();

    await expect
      .element(page.getByText("The recording didn't load. Check your connection and try again."))
      .toBeVisible();

    await expect.element(page.getByRole("button", { name: "Play the recording" })).toBeEnabled();
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it("plays and pauses freely in review, without counting plays", async () => {
    const onPlayed = vi.fn();
    render(<Recording onPlayed={onPlayed} plays={null} url={toneUrl(3)} />);

    await expect.element(page.getByText("Listen again as often as you like.")).toBeVisible();
    await page.getByRole("button", { name: "Play the recording" }).click();
    await page.getByRole("button", { name: "Pause" }).click();

    await expect.element(page.getByRole("button", { name: "Play the recording" })).toBeEnabled();
    expect(onPlayed).not.toHaveBeenCalled();
  });
});

const PLAYING = "Playing. It doesn't pause, like in the exam.";
const USED_UP = "You've used every play. Answer from what you heard.";

const RESTARTED =
  "The recording stopped before the end, so you can play it once more from the start.";

/** Stops the recording the way the system does mid-play: no learner control does this. */
function cutOff() {
  document.querySelector("audio")?.pause();
}

/** A set's recording as practice and mocks get it, before its questions are answered. */
function setView(url: string) {
  return {
    audio: { durationMs: 400, url },
    plays: 1 as const,
    task: "Part 1: a conversation between two people in an everyday social context",
    title: "Booking a hall",
    transcript: null,
  };
}

describe("a set's recording", () => {
  it("keeps its play limit across the set's questions, each of which shows it", async () => {
    const playsKey = crypto.randomUUID();
    const view = setView(toneUrl(0.4));
    const { unmount } = render(<ListeningStimulus set={view} playsKey={playsKey} />);

    await expect.element(page.getByText(view.task)).toBeVisible();
    await page.getByRole("button", { name: "Play the recording" }).click();

    await expect
      .element(page.getByText("You've used every play. Answer from what you heard."), {
        timeout: PLAY_TIMEOUT,
      })
      .toBeVisible();

    // The next question of the set shows the same recording: its play is still used.
    unmount();
    render(<ListeningStimulus set={view} playsKey={playsKey} />);

    await expect.element(page.getByRole("button", { name: "Play it again" })).toBeDisabled();
  });

  it("starts with every play when the same recording is asked again elsewhere", async () => {
    const view = setView(toneUrl(0.4));
    const { unmount } = render(<ListeningStimulus set={view} playsKey={`block-1:${view.title}`} />);

    await page.getByRole("button", { name: "Play the recording" }).click();
    await expect.element(page.getByText(USED_UP), { timeout: PLAY_TIMEOUT }).toBeVisible();

    // A later block (a mistake's drill) or a mock asks the same recording: its own plays.
    unmount();
    render(<ListeningStimulus set={view} playsKey={`block-2:${view.title}`} />);

    await expect.element(page.getByRole("button", { name: "Play the recording" })).toBeEnabled();
    await expect.element(page.getByText(USED_UP)).not.toBeInTheDocument();
  });

  it("lists the set's questions to read before it plays, then folds them while it plays", async () => {
    const questions = {
      current: 0,
      prompts: ["Which room does Tom book?", "Which day does Tom book in the end?"],
    };

    render(
      <ListeningStimulus
        questions={questions}
        set={setView(toneUrl(1.2))}
        playsKey={crypto.randomUUID()}
      />,
    );

    const list = page.getByRole("button", { name: "Questions on this recording (2)" });

    await expect.element(list).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByText("Which day does Tom book in the end?")).toBeVisible();

    await page.getByRole("button", { name: "Play the recording" }).click();

    await expect.element(list).toHaveAttribute("aria-expanded", "false");

    await expect
      .element(page.getByText("Which day does Tom book in the end?"))
      .not.toBeInTheDocument();

    // The learner can read them again while it plays.
    await list.click();
    await expect.element(page.getByText("Which day does Tom book in the end?")).toBeVisible();
  });

  it("keeps the questions folded when a reload finds the play used", async () => {
    const playsKey = crypto.randomUUID();

    const ui = (
      <ListeningStimulus
        playsKey={playsKey}
        questions={{ current: 0, prompts: ["Which room does Tom book?", "Which day?"] }}
        set={setView(toneUrl(0.4))}
      />
    );

    const { unmount } = render(ui);

    await page.getByRole("button", { name: "Play the recording" }).click();
    await expect.element(page.getByText(USED_UP), { timeout: PLAY_TIMEOUT }).toBeVisible();

    // The page comes back from the server, which can't know the plays, and hydrates: the question
    // on screen stays in view.
    unmount();
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui);
    document.body.append(container);
    render(ui, { container, hydrate: true });

    await expect.element(page.getByText(USED_UP)).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Questions on this recording (2)" }))
      .toHaveAttribute("aria-expanded", "false");
  });

  it("shows who said what and plays freely once its questions are answered", async () => {
    const playsKey = crypto.randomUUID();

    render(
      <ListeningStimulus
        set={{
          ...setView(toneUrl(0.4)),
          transcript: [
            { speaker: "Receptionist", text: "Which day were you thinking of?" },
            { speaker: "Tom", text: "Tuesday, no, sorry, Thursday the twelfth." },
            { speaker: "Tom", text: "We'll need it from six." },
          ],
        }}
        playsKey={playsKey}
      />,
    );

    const transcript = page.getByRole("region", { name: "Transcript" });

    // Folded, so the last answer's feedback stays in view.
    await expect.element(transcript.getByText("Receptionist")).not.toBeInTheDocument();
    await transcript.getByRole("button", { name: "Transcript" }).click();
    await expect.element(transcript.getByText("Receptionist")).toBeVisible();

    // One speaker's next paragraph goes on under their name, not a new one.
    expect(transcript.getByText("Tom", { exact: true }).elements()).toHaveLength(1);

    await expect
      .element(transcript.getByText("Tuesday, no, sorry, Thursday the twelfth."))
      .toBeVisible();

    await expect.element(page.getByText("Listen again as often as you like.")).toBeVisible();
  });

  it("in practice, gives back a play cut off before its end, once, and says so", async () => {
    render(<ListeningStimulus practice set={setView(toneUrl(3))} playsKey={crypto.randomUUID()} />);

    await page.getByRole("button", { name: "Play the recording" }).click();
    await expect.element(page.getByText(PLAYING)).toBeVisible();

    // The system pauses it (a call, the app sent to the background): the play comes back.
    cutOff();
    await expect.element(page.getByText(RESTARTED)).toBeVisible();
    await page.getByRole("button", { name: "Play the recording" }).click();
    await expect.element(page.getByText(PLAYING)).toBeVisible();

    // A second cut-off counts, like any play.
    cutOff();
    await expect.element(page.getByText(USED_UP)).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Play it again" })).toBeDisabled();
  });

  it("in practice, gives back a play cut off by a reload", async () => {
    const playsKey = crypto.randomUUID();
    const view = setView(toneUrl(3));
    const { unmount } = render(<ListeningStimulus practice set={view} playsKey={playsKey} />);

    await page.getByRole("button", { name: "Play the recording" }).click();
    await expect.element(page.getByText(PLAYING)).toBeVisible();

    unmount();
    render(<ListeningStimulus practice set={view} playsKey={playsKey} />);

    await expect.element(page.getByText(RESTARTED)).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Play the recording" })).toBeEnabled();
  });

  it("in a mock, counts a play cut off before its end, as the exam does", async () => {
    const playsKey = crypto.randomUUID();
    const view = setView(toneUrl(3));
    const { unmount } = render(<ListeningStimulus set={view} playsKey={playsKey} />);

    await page.getByRole("button", { name: "Play the recording" }).click();
    await expect.element(page.getByText(PLAYING)).toBeVisible();

    cutOff();
    await expect.element(page.getByText(USED_UP)).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Play it again" })).toBeDisabled();

    unmount();
    render(<ListeningStimulus set={view} playsKey={playsKey} />);

    await expect.element(page.getByText(USED_UP)).toBeVisible();
    expect(page.getByText(RESTARTED).elements()).toHaveLength(0);
  });

  it("in a mock, counts a play cut off by a reload", async () => {
    const playsKey = crypto.randomUUID();
    const view = setView(toneUrl(3));
    const { unmount } = render(<ListeningStimulus set={view} playsKey={playsKey} />);

    await page.getByRole("button", { name: "Play the recording" }).click();
    await expect.element(page.getByText(PLAYING)).toBeVisible();

    unmount();
    render(<ListeningStimulus set={view} playsKey={playsKey} />);

    await expect.element(page.getByText(USED_UP)).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Play it again" })).toBeDisabled();
  });

  it("in a mock, opens with the plays another tab or device used", async () => {
    const record = vi.fn(async () => true);

    render(
      <ListeningStimulus
        playsKey={crypto.randomUUID()}
        served={{ played: 1, record }}
        set={setView(toneUrl(0.4))}
      />,
    );

    await expect.element(page.getByText(USED_UP)).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Play it again" })).toBeDisabled();
    expect(record).not.toHaveBeenCalled();
  });

  it("in a mock, counts each play on the mock as it starts", async () => {
    const record = vi.fn(async () => true);

    render(
      <ListeningStimulus
        playsKey={crypto.randomUUID()}
        served={{ played: 0, record }}
        set={setView(toneUrl(0.4))}
      />,
    );

    await page.getByRole("button", { name: "Play the recording" }).click();
    await expect.element(page.getByText(USED_UP), { timeout: PLAY_TIMEOUT }).toBeVisible();
    expect(record).toHaveBeenCalledOnce();
  });

  it("in a mock, stops a play the mock had none left for, from a page that didn't know", async () => {
    const record = vi.fn(async () => false);

    render(
      <ListeningStimulus
        playsKey={crypto.randomUUID()}
        served={{ played: 0, record }}
        set={setView(toneUrl(3))}
      />,
    );

    await page.getByRole("button", { name: "Play the recording" }).click();

    // Stopped right away, well before the 3-second recording's end.
    await expect.element(page.getByText(USED_UP), { timeout: 1000 }).toBeVisible();
    expect(record).toHaveBeenCalledOnce();
    expect(document.querySelector("audio")?.paused).toBe(true);
    await expect.element(page.getByRole("button", { name: "Play it again" })).toBeDisabled();
  });

  it("shows nothing while the recording isn't voiced", async () => {
    const { container } = render(
      <ListeningStimulus set={{ ...setView(""), audio: null }} playsKey={crypto.randomUUID()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
