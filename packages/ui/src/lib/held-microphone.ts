export type HeldMicrophone = { context: AudioContext; stream: Promise<MediaStream> };

type HeldPresses = {
  /** Called once the root has committed: from then on a node carrying React's props is React's. */
  commit: () => void;
  microphone: HeldMicrophone | null;
};

declare global {
  var zoonkHeldPresses: HeldPresses | undefined;
}

/**
 * The microphone a press held before the page hydrated asked for in its tap, taken once; null when
 * none did. Apart from the script that asks, so a call's code doesn't carry the script.
 */
export function takeHeldMicrophone(): HeldMicrophone | null {
  const state = globalThis.zoonkHeldPresses;
  const asked = state?.microphone ?? null;

  if (state) {
    state.microphone = null;
  }

  return asked;
}
