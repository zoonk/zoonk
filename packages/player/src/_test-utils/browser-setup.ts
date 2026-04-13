import "@zoonk/ui/globals.css";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

const AUDIO_READY_STATE = 4;

type MockAudioInstance = {
  addEventListener: () => null;
  currentTime: number;
  load: () => null;
  pause: () => null;
  play: () => Promise<void>;
  preload: string;
  readyState: number;
  removeAttribute: () => null;
  src: string;
};

/**
 * Audio playback is not part of these interaction tests, but several player
 * variants render audio controls. This stub makes those controls mount and
 * click normally without depending on browser media support.
 */
const MockAudio = vi.fn(function MockAudio(this: MockAudioInstance) {
  this.currentTime = 0;
  this.preload = "auto";
  this.readyState = AUDIO_READY_STATE;
  this.src = "";
  this.addEventListener = () => null;
  this.load = () => null;
  this.pause = () => null;
  this.play = () => Promise.resolve();
  this.removeAttribute = () => null;
});

/**
 * The player package ships Tailwind utility class names, but browser tests do
 * not boot a full app stylesheet pipeline. This tiny shim restores the
 * visibility rules that decide whether desktop or mobile controls are active.
 */
function mountResponsiveVisibilityStyles() {
  const style = document.createElement("style");

  style.textContent = `
    .hidden {
      display: none !important;
    }

    @media (min-width: 1024px) {
      .lg\\:hidden {
        display: none !important;
      }

      .lg\\:flex {
        display: flex !important;
      }

      .lg\\:inline-flex {
        display: inline-flex !important;
      }

      .lg\\:grid {
        display: grid !important;
      }
    }
  `;

  document.head.append(style);
}

beforeAll(() => {
  vi.stubGlobal("Audio", MockAudio);
  vi.stubGlobal("process", { env: { NODE_ENV: "test" } });
  mountResponsiveVisibilityStyles();
});

afterEach(() => {
  cleanup();
});
