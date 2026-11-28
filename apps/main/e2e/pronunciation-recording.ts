import { type Page } from "@playwright/test";
import { PRONUNCIATION_RECORDING } from "../../../packages/e2e/src/pronunciation-grader";

export async function allowPronunciationRecording(page: Page) {
  await page.addInitScript(
    (recording) => {
      class TestRecorder extends EventTarget {
        static isTypeSupported() {
          return true;
        }

        mimeType = "audio/webm";
        state = "inactive";

        start() {
          this.state = "recording";
          queueMicrotask(() => this.dispatchEvent(new Event("start")));
        }

        stop() {
          this.state = "inactive";

          queueMicrotask(() => {
            const data = new Blob([new Uint8Array(recording)]);
            this.dispatchEvent(new BlobEvent("dataavailable", { data }));
            this.dispatchEvent(new Event("stop"));
          });
        }
      }

      Object.defineProperty(globalThis, "MediaRecorder", { value: TestRecorder });

      const track = {
        stop() {
          /** This fixture has no device resources to release. */
        },
      };

      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => ({ getAudioTracks: () => [track], getTracks: () => [track] }),
      });
    },
    [...PRONUNCIATION_RECORDING],
  );
}
