import { describe, expect, it } from "vitest";
import { claimPlayerShortcutHint } from "./player-shortcut-hint-storage";

/**
 * Gives each test an isolated browser-storage substitute so daily hint claims
 * can be verified without depending on jsdom's shared localStorage state.
 */
function createShortcutHintStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe(claimPlayerShortcutHint, () => {
  it("claims each shortcut independently once per local calendar day", () => {
    const storage = createShortcutHintStorage();
    const localDate = "2026-07-13";

    expect(claimPlayerShortcutHint({ hint: "navigateNext", localDate, storage })).toBe(true);

    expect(claimPlayerShortcutHint({ hint: "navigateNext", localDate, storage })).toBe(false);

    expect(claimPlayerShortcutHint({ hint: "navigatePrevious", localDate, storage })).toBe(true);
  });

  it("allows the same shortcut on the next local calendar day", () => {
    const storage = createShortcutHintStorage();

    expect(claimPlayerShortcutHint({ hint: "promptAudio", localDate: "2026-07-13", storage })).toBe(
      true,
    );

    expect(claimPlayerShortcutHint({ hint: "promptAudio", localDate: "2026-07-14", storage })).toBe(
      true,
    );
  });

  it("recovers from corrupted stored history", () => {
    const values = new Map<string, string>();

    const storage = {
      getItem: (key: string) => values.get(key) ?? "not-a-date",
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(claimPlayerShortcutHint({ hint: "checkAnswer", localDate: "2026-07-13", storage })).toBe(
      true,
    );

    expect(claimPlayerShortcutHint({ hint: "checkAnswer", localDate: "2026-07-13", storage })).toBe(
      false,
    );
  });

  it("fails closed when browser storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new Error("Storage is unavailable");
      },
      setItem: () => {
        throw new Error("Storage is unavailable");
      },
    };

    expect(
      claimPlayerShortcutHint({ hint: "multipleChoiceNumber", localDate: "2026-07-13", storage }),
    ).toBe(false);
  });
});
