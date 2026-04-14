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

beforeAll(() => {
  vi.stubGlobal("Audio", MockAudio);
  vi.stubGlobal("process", { env: { NODE_ENV: "test" } });
});

afterEach(() => {
  cleanup();
});
