import { describe, expect, it } from "vitest";
import { getTemplateRomanization } from "./template-romanization";

describe(getTemplateRomanization, () => {
  it("returns null when sentence is null", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: null })).toBeNull();
  });

  it("returns null when sentence is undefined", () => {
    expect(getTemplateRomanization({ answer: "o" })).toBeNull();
  });

  it("returns full sentence when answer is null", () => {
    expect(getTemplateRomanization({ answer: null, sentence: "okane o onegai shimasu." })).toBe(
      "okane o onegai shimasu.",
    );
  });

  it("returns full sentence when answer is undefined", () => {
    expect(getTemplateRomanization({ sentence: "okane o onegai shimasu." })).toBe(
      "okane o onegai shimasu.",
    );
  });

  it("replaces answer surrounded by spaces", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "okane o onegai shimasu." })).toBe(
      "okane ____ onegai shimasu.",
    );
  });

  it("does not replace answer inside a longer word", () => {
    expect(
      getTemplateRomanization({ answer: "o", sentence: "okane o onegai shimasu." }),
    ).not.toContain("____kane");
  });

  it("replaces answer at the start of the sentence", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "o okane onegai shimasu." })).toBe(
      "____ okane onegai shimasu.",
    );
  });

  it("replaces answer at the end of the sentence without punctuation", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "watashi wa o" })).toBe(
      "watashi wa ____",
    );
  });

  it("replaces answer followed by a period", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "watashi wa o." })).toBe(
      "watashi wa ____.",
    );
  });

  it("replaces answer followed by a comma", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "o, sore wa ii desu." })).toBe(
      "____, sore wa ii desu.",
    );
  });

  it("replaces answer followed by an exclamation mark", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "watashi wa o!" })).toBe(
      "watashi wa ____!",
    );
  });

  it("replaces answer followed by a question mark", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "watashi wa o?" })).toBe(
      "watashi wa ____?",
    );
  });

  it("replaces only the first standalone occurrence", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "o o shimasu" })).toBe(
      "____ o shimasu",
    );
  });

  it("handles answer containing regex metacharacters", () => {
    expect(getTemplateRomanization({ answer: "(world)", sentence: "say hello (world) now" })).toBe(
      "say hello ____ now",
    );
  });

  it("handles answer with dots that could be regex wildcards", () => {
    expect(getTemplateRomanization({ answer: "mr.", sentence: "say mr. smith now" })).toBe(
      "say ____ smith now",
    );
  });

  it("returns sentence unchanged when answer is not a standalone word", () => {
    expect(getTemplateRomanization({ answer: "o", sentence: "okane onegai shimasu" })).toBe(
      "okane onegai shimasu",
    );
  });

  it("handles accented characters in romanization", () => {
    expect(getTemplateRomanization({ answer: "ōkii", sentence: "tōkyō wa ōkii desu." })).toBe(
      "tōkyō wa ____ desu.",
    );
  });

  it("handles case differences between answer and sentence", () => {
    expect(
      getTemplateRomanization({
        answer: "ohayō gozaimasu",
        sentence: 'Asa hachi-ji desu. "Ohayō gozaimasu."',
      }),
    ).toBe('Asa hachi-ji desu. "____."');
  });

  it("handles answer inside quotes", () => {
    expect(
      getTemplateRomanization({ answer: "konbanwa", sentence: 'Yoru shichi-ji desu. "Konbanwa."' }),
    ).toBe('Yoru shichi-ji desu. "____."');
  });
});
