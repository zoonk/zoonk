import { isDeepStrictEqual } from "node:util";
import { isJsonObject } from "@zoonk/utils/json";
import { type MistakeReplay } from "./mistake-replay";

function orderedContent(content: unknown): unknown {
  if (!isJsonObject(content) || !Array.isArray(content.options)) {
    return content;
  }

  const options = content.options.toSorted((left, right) => {
    const first = isJsonObject(left) ? JSON.stringify(left.id ?? left.text) : JSON.stringify(left);

    const second = isJsonObject(right)
      ? JSON.stringify(right.id ?? right.text)
      : JSON.stringify(right);

    return first.localeCompare(second);
  });

  return { ...content, options };
}

function questionContent(replay: MistakeReplay): unknown {
  if (replay.kind === "item") {
    const { content, format, set } = replay.item;
    const image = "image" in replay.item ? replay.item.image : null;

    return {
      content: orderedContent(content),
      format,
      image,
      math: replay.math ?? null,
      set: set ?? null,
    };
  }

  const { step } = replay.lesson;

  if ("exercise" in step) {
    const { content, sentence, word } = step.exercise;
    return { content: orderedContent(content), kind: step.kind, sentence, word };
  }

  return {
    content: orderedContent(step.content),
    image: step.image,
    kind: step.kind,
    optionPictures: step.optionPictures ?? null,
  };
}

export function isSameMistakeQuestion({
  answered,
  saved,
}: {
  answered: MistakeReplay;
  saved: MistakeReplay;
}): boolean {
  const savedJson = JSON.stringify(questionContent(saved));
  const answeredJson = JSON.stringify(questionContent(answered));
  const savedContent: unknown = JSON.parse(savedJson);
  const answeredContent: unknown = JSON.parse(answeredJson);
  return isDeepStrictEqual(savedContent, answeredContent);
}
