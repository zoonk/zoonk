import { isDeepStrictEqual } from "node:util";
import { getStepQuestion } from "../lesson-player/_utils/step-question";
import { getStepSampleAnswer } from "../lesson-player/_utils/step-sample-answer";
import { gradeMistakeItem, toMistakeQuestion } from "./mistake-item";
import { type MistakeReplay } from "./mistake-replay";
import { type MistakeSnapshot, readMistakeSnapshot } from "./mistake-snapshot";

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  return (
    (left ?? "").replaceAll(/\s+/gu, " ").trim() === (right ?? "").replaceAll(/\s+/gu, " ").trim()
  );
}

function matchesItemSource({
  replay,
  saved,
}: {
  replay: Extract<MistakeReplay, { kind: "item" }>;
  saved: MistakeSnapshot;
}): boolean {
  const graded = gradeMistakeItem({ answer: { dontKnow: true }, replay });

  if (!saved.question || !sameText(saved.question, graded.snapshot.question)) {
    return false;
  }

  if (saved.correctAnswer && !sameText(saved.correctAnswer, graded.snapshot.correctAnswer)) {
    return false;
  }

  const shown = toMistakeQuestion(replay);
  const fields = ["context", "image", "set", "visual"] as const;

  return fields.every(
    (name) => saved[name] === undefined || isDeepStrictEqual(saved[name], shown[name]),
  );
}

/** A legacy source is usable only while the preserved question and known stimulus still match. */
export function matchesMistakeSource({
  replay,
  snapshot,
}: {
  replay: MistakeReplay;
  snapshot: unknown;
}): boolean {
  const saved = readMistakeSnapshot(snapshot);

  if (replay.kind === "item") {
    return matchesItemSource({ replay, saved });
  }

  if (!saved.question || !sameText(saved.question, getStepQuestion(replay.lesson.step))) {
    return false;
  }

  const step = replay.lesson.step;
  const content = "content" in step ? step.content : step.exercise.content;

  const context =
    "context" in content && typeof content.context === "string" ? content.context : null;

  const visual = "visual" in content ? content.visual : null;
  const image = "image" in step ? step.image : null;

  if (saved.context !== undefined && !sameText(saved.context, context)) {
    return false;
  }

  if (saved.visual !== undefined && !isDeepStrictEqual(saved.visual, visual)) {
    return false;
  }

  if (saved.image && saved.image.url !== image?.url) {
    return false;
  }

  const sample = getStepSampleAnswer(step);

  return (
    step.kind === "typedAnswer" ||
    !saved.correctAnswer ||
    !sample ||
    sameText(saved.correctAnswer, sample)
  );
}
