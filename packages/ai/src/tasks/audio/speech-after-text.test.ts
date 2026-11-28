import { describe, expect, it } from "vitest";
import { saysMoreThanText } from "./speech-after-text";

describe(saysMoreThanText, () => {
  it.each([
    ["it", "abito a", "Abito a Ca."],
    ["it", "studio a", "Studio a Palermo."],
    ["it", "studio a", "Studio Atene."],
    ["it", "vivo in", "Vivo in Sp-"],
    ["fr", "j'habite à", "J'habite à Paris."],
    ["de", "ich wohne in", "Ich wohne in Berlin."],
    ["ja", "東京に", "東京に行きます。"],
  ])("hears %s %j go on as %j", (language, text, heard) => {
    expect(saysMoreThanText({ heard, language, text })).toBe(true);
  });

  it.each([
    ["it", "abito a", "Abito a."],
    ["it", "abito a", "Abito, a."],
    ["it", "studio a", "Studio. Ah."],
    ["en", "A single-ride ticket, please", "A single ride ticket, please."],
    ["en", "My phone number is", "My phone number is."],
    ["it", "Qual è", "Quale?"],
    ["it", "a presto", "A. Presco."],
    ["en", "I'm from", "I am from."],
    ["es", "21 años", "Veintiún años."],
    ["it", "Buona serata", "Buona serata!"],
    ["en", "...", "Hello."],
  ])("hears %s %j as only its text in %j", (language, text, heard) => {
    expect(saysMoreThanText({ heard, language, text })).toBe(false);
  });
});
