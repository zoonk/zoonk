import { describe, expect, it } from "vitest";
import { findLongSentences } from "./reading-level";

describe(findLongSentences, () => {
  it("counts the words between two prices, which the players show as text", () => {
    const text =
      "Kids pay $5 at the gate on any weekday morning before the first show starts, and adults pay $10 at the same gate, which is why many families come early on weekdays to save money.";

    expect(findLongSentences({ level: "beginner", text })).toStrictEqual([text]);
  });

  it("counts a formula as one word, whichever delimiters it has", () => {
    const letters = "a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s + t";
    const text = String.raw`Solve \(${letters}\) or \[${letters}\] or $${letters}$ for the sum of every letter here.`;

    expect(findLongSentences({ level: "beginner", text })).toStrictEqual([]);
  });
});
