import { describe, expect, it } from "vitest";
import { getGuestIdleMs, parseElapsedMs } from "./emulators.mts";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

describe(getGuestIdleMs, () => {
  it("takes the latest of a tap and an app coming to the front", () => {
    const tappedMs = 5139;
    const openedSeconds = 4;

    const dumpsys = `
  mWakefulness=Awake
  mLastInteractivePowerHintTime=131506 (${tappedMs} ms ago)
 mLastUserActivityTime(excludingAttention)=131506
    id=233 userId=0 hasTask=true lastActiveTime=131550
    lastActiveTime=131550 (inactive for ${openedSeconds}s)
    lastActiveTime=99845 (inactive for 36s)`;

    expect(getGuestIdleMs(dumpsys)).toBe(openedSeconds * SECOND_MS);
  });

  it("reads hours of idleness on Android 14", () => {
    const tappedMs = 8_994_191;

    const dumpsys = `
  mLastInteractivePowerHintTime=577833678 (${tappedMs} ms ago)
    lastActiveTime=577829583 (inactive for 8998s)`;

    expect(getGuestIdleMs(dumpsys)).toBe(tappedMs);
  });

  it("knows nothing while the emulator boots", () => {
    expect(getGuestIdleMs("Can't find service: power")).toBeUndefined();
  });
});

describe(parseElapsedMs, () => {
  it("reads minutes, hours and days", () => {
    const days = 6;
    const hours = 2;
    const minutes = 24;
    const seconds = 17;

    expect(parseElapsedMs(`${minutes}:${seconds}`)).toBe(minutes * MINUTE_MS + seconds * SECOND_MS);

    expect(parseElapsedMs(` 0${hours}:00:${seconds}\n`)).toBe(
      hours * HOUR_MS + seconds * SECOND_MS,
    );

    expect(parseElapsedMs(`0${days}-0${hours}:${minutes}:${seconds}`)).toBe(
      days * DAY_MS + hours * HOUR_MS + minutes * MINUTE_MS + seconds * SECOND_MS,
    );
  });

  it("knows nothing when the process is gone", () => {
    expect(parseElapsedMs("")).toBeUndefined();
  });
});
