import { type Page } from "@playwright/test";
import { ONE_SECOND_RECORDING } from "@zoonk/testing/fixtures/recordings";

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
    },
    [...ONE_SECOND_RECORDING],
  );
}
