import { isDeepStrictEqual } from "node:util";
import { isJsonObject } from "@zoonk/utils/json";
import { getScreenReadingTexts, holdsQuote } from "../../../../library/steps/question-bases";
import { type Screen, type ScreenList } from "./schema";
import { type ScreenLesson } from "./snapshot";

export function remapBasis({
  content,
  original,
  list,
  lesson,
}: {
  content: Screen["content"];
  original: Screen["content"] | undefined;
  list: ScreenList;
  lesson: ScreenLesson;
}) {
  const basis = content.basis;

  if (!isJsonObject(basis) || !isDeepStrictEqual(basis, original?.basis)) {
    return content;
  }

  const source = lesson.before.screens.find((row) => row.position === basis.position);
  const position = list.screens.findIndex((entry) => "id" in entry && entry.id === source?.id);
  return { ...content, basis: { ...basis, position } };
}

export function checkBasis({
  content,
  screens,
  path,
  index,
  problems,
}: {
  content: Screen["content"];
  screens: Screen[];
  path: string;
  index: number;
  problems: string[];
}) {
  const basis = content.basis;

  if (
    !isJsonObject(basis) ||
    typeof basis.position !== "number" ||
    typeof basis.quote !== "string"
  ) {
    return;
  }

  const texts = getScreenReadingTexts(screens[basis.position]);

  if (!texts || basis.position >= index || !holdsQuote({ quote: basis.quote, texts })) {
    problems.push(
      `${path}.basis.position: keep the earlier screen saying "${basis.quote}" or update the question's basis to quote its new source.`,
    );
  }
}
