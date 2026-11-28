import { OnboardingPrimaryButton } from "@zoonk/learn/onboarding/frame";
import { RecordButton } from "@zoonk/learn/speech/record-button";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../_test-utils/render";

const HELD_ENTER = "{Enter>8}{/Enter}";

function Recorder({ onStart, onStop }: { onStart: () => void; onStop: () => void }) {
  const [recording, setRecording] = useState(false);

  return (
    <RecordButton
      elapsedMs={0}
      onStart={() => {
        onStart();
        setRecording(true);
      }}
      onStop={() => {
        onStop();
        setRecording(false);
      }}
      recording={recording}
    />
  );
}

/** An answer, then a result like `TestOutcome`'s, whose Continue takes focus as it opens. */
function AnswerThenResult() {
  const [screen, setScreen] = useState<"answer" | "next" | "result">("answer");

  if (screen === "answer") {
    return (
      <OnboardingPrimaryButton onClick={() => setScreen("result")}>Check</OnboardingPrimaryButton>
    );
  }

  if (screen === "result") {
    return (
      <>
        <h1>Your result</h1>
        <OnboardingPrimaryButton autoFocus onClick={() => setScreen("next")}>
          Continue
        </OnboardingPrimaryButton>
      </>
    );
  }

  return <h1>Next step</h1>;
}

describe("a held Enter presses a screen's main action once", () => {
  it("starts a recording and leaves it running", async () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(<Recorder onStart={onStart} onStop={onStop} />);

    await userEvent.keyboard(HELD_ENTER);

    await expect.element(page.getByRole("button", { name: /^Stop/u })).toBeVisible();
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStop).not.toHaveBeenCalled();
  });

  it("answers, and the result that opens with its Continue in focus stays on screen", async () => {
    render(<AnswerThenResult />);

    await userEvent.keyboard(HELD_ENTER);

    await expect.element(page.getByRole("heading", { name: "Your result" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: /^Continue/u })).toHaveFocus();
  });
});
