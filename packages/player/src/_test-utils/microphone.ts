import { onTestFinished, vi } from "vitest";

/** A device-free microphone that feeds real samples to the browser's encoder. */
export function allowMicrophone() {
  const audio = new AudioContext();
  const tone = audio.createOscillator();
  tone.start();

  const microphone = vi
    .spyOn(navigator.mediaDevices, "getUserMedia")
    .mockImplementation(async () => {
      const destination = audio.createMediaStreamDestination();
      tone.connect(destination);
      await audio.resume();
      return destination.stream;
    });

  onTestFinished(() => audio.close());
  return microphone;
}
