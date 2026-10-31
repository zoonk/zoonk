import { describe, expect, it } from "vitest";
import { mapPlaceholders, parseEnglish } from "./placeholders.ts";

function english(message: string) {
  return parseEnglish(message)!;
}

describe(parseEnglish, () => {
  it("gives web, Android, and Apple copies of the same English one key", () => {
    const web = english("Hi {name}, you have {count} lessons left");
    const native = english("Hi {arg1}, you have {arg2} lessons left");

    expect(web.key).toBe(native.key);
    expect(web.names).toStrictEqual(["name", "count"]);
    expect(native.names).toStrictEqual(["arg1", "arg2"]);
    expect(web.words).toBe(7);
  });

  it("tells placeholders apart by format and by which one repeats", () => {
    expect(english("{count} left").key).not.toBe(english("{count, number} left").key);
    expect(english("{a} and {a}").key).not.toBe(english("{a} and {b}").key);
    expect(english("{a} and {a}").names).toStrictEqual(["a"]);
  });

  it("reads tags as text", () => {
    expect(english("<link>Read {name}</link>").key).toContain("<link>Read ");
  });

  it("leaves plurals, selects, ICU quotes, and broken ICU out", () => {
    expect(parseEnglish("{count, plural, one {# day} other {# days}}")).toBeUndefined();
    expect(parseEnglish("{mode, select, day {Today} other {Later}}")).toBeUndefined();
    expect(parseEnglish("Use '{braces}' freely")).toBeUndefined();
    expect(parseEnglish("Broken {name")).toBeUndefined();
  });
});

describe(mapPlaceholders, () => {
  it("renames placeholders by their position in each English", () => {
    expect(
      mapPlaceholders({
        from: english("Hi {arg1}, {arg2} lessons left"),
        to: english("Hi {name}, {count} lessons left"),
        translation: "{arg2} lições restantes, {arg1}",
      }),
    ).toBe("{count} lições restantes, {name}");
  });

  it("keeps formats and the rest of the text byte for byte", () => {
    expect(
      mapPlaceholders({
        from: english("Time: {total, number}"),
        to: english("Time: {arg1, number}"),
        translation: "l'heure: { total, number }",
      }),
    ).toBe("l'heure: { arg1, number }");

    expect(
      mapPlaceholders({
        from: english("Hi, {name}!"),
        to: english("Hi, {name}!"),
        translation: "Olá, {name}!",
      }),
    ).toBe("Olá, {name}!");
  });

  it("gives up when the translation's placeholders aren't exactly its English's", () => {
    const from = english("Your score is {count}");
    const to = english("Your score is {arg1}");

    expect(mapPlaceholders({ from, to, translation: "Ton score est {nombre}" })).toBeUndefined();
    expect(mapPlaceholders({ from, to, translation: "Score : {count, number}" })).toBeUndefined();
    expect(mapPlaceholders({ from, to, translation: "Score : '{count}'" })).toBeUndefined();

    expect(
      mapPlaceholders({ from, to, translation: "{count, plural, one {# point} other {# points}}" }),
    ).toBeUndefined();
  });
});
