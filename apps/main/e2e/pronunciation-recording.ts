import { type Page } from "@playwright/test";
import { PRONUNCIATION_RECORDING } from "../../../packages/e2e/src/pronunciation-grader";

/** Uses the player's EventTarget recorder fake pattern; no real microphone or provider opens. */
export async function allowPronunciationRecording(page: Page) {
  await page.addInitScript((recording) => {
    class TestRecorder extends EventTarget {
      static isTypeSupported() {
        return true;
      }

      mimeType = "audio/webm";
      state = "inactive";

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";

        queueMicrotask(() => {
          this.dispatchEvent(new BlobEvent("dataavailable", { data: new Blob([recording]) }));
          this.dispatchEvent(new Event("stop"));
        });
      }
    }

    Object.defineProperty(globalThis, "MediaRecorder", { value: TestRecorder });

    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => ({
        getTracks: () => [
          {
            stop() {
              /** This fixture has no device resources to release. */
            },
          },
        ],
      }),
    });
  }, PRONUNCIATION_RECORDING);
}
