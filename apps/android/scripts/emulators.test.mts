import { describe, expect, it } from "vitest";
import { getGuestIdleMs, parseElapsedMs } from "./emulators.mts";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RECENTS_HEADER = "ACTIVITY MANAGER RECENT TASKS (dumpsys activity recents)";

describe(getGuestIdleMs, () => {
  it("takes the latest of a tap and an app coming to the front", () => {
    const tappedMs = 5139;
    const openedSeconds = 4;

    const power = `
  mWakefulness=Awake
  mLastInteractivePowerHintTime=131506 (${tappedMs} ms ago)
 mLastUserActivityTime(excludingAttention)=131506`;

    const recents = `${RECENTS_HEADER}
    id=233 userId=0 hasTask=true lastActiveTime=131550
    lastActiveTime=131550 (inactive for ${openedSeconds}s)
    lastActiveTime=99845 (inactive for 36s)`;

    expect(getGuestIdleMs({ power, recents })).toBe(openedSeconds * SECOND_MS);
  });

  it("reads hours of idleness on Android 14", () => {
    const tappedMs = 8_994_191;

    const power = `  mLastInteractivePowerHintTime=577833678 (${tappedMs} ms ago)`;
    const recents = `${RECENTS_HEADER}\n    lastActiveTime=577829583 (inactive for 8998s)`;

    expect(getGuestIdleMs({ power, recents })).toBe(tappedMs);
  });

  it("counts from the last tap when no app was opened since boot", () => {
    const tappedMs = 30_000;
    const power = `  mLastInteractivePowerHintTime=1 (${tappedMs} ms ago)`;

    expect(getGuestIdleMs({ power, recents: RECENTS_HEADER })).toBe(tappedMs);
  });

  it("knows nothing unless both dumps are whole", () => {
    const power = "  mLastInteractivePowerHintTime=1 (8000000 ms ago)";

    expect(
      getGuestIdleMs({ power: "Can't find service: power", recents: RECENTS_HEADER }),
    ).toBeUndefined();

    expect(getGuestIdleMs({ power, recents: "Can't find service: activity" })).toBeUndefined();
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
