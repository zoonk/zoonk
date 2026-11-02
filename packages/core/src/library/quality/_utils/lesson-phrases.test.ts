import { describe, expect, it } from "vitest";
import { findLessonPhrases } from "./lesson-phrases";

describe(findLessonPhrases, () => {
  it.each([
    ["ja", "このレッスンでは、光合成の仕組みを学びます。", "このレッスンで"],
    ["ko", "이번 레슨에서는 광합성을 배워요.", "이번 레슨에서"],
    ["tr", "Bu derste fotosentezi öğreneceksin.", "bu derste"],
    ["pl", "Na tej lekcji poznasz fotosyntezę.", "na tej lekcji"],
  ])("finds %s lesson framing", (language, text, phrase) => {
    expect(findLessonPhrases({ language, text }).framing).toStrictEqual([phrase]);
  });

  it.each([
    ["ko", "선생님이 레슨에서 배운 내용을 정리해요. 여기서 주목할 점은 분모예요."],
    ["ja", "ここで注目すべきは、分母です。シアノバクテリアは太古の昔から光合成をしてきました。"],
  ])("leaves ordinary %s teaching alone", (language, text) => {
    expect(findLessonPhrases({ language, text })).toStrictEqual({ filler: [], framing: [] });
  });

  it("finds Japanese filler written without spaces", () => {
    expect(
      findLessonPhrases({ language: "ja", text: "言うまでもなく、植物は光を使います。" }).filler,
    ).toStrictEqual(["言うまでもなく"]);
  });
});
