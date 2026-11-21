import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isNotebookQuestionStep } from "../../../../library/lessons/_utils/lesson-screen-skill";
import { toScreenQuestion } from "../../../../library/lessons/_utils/screen-question-item";
import { toMathCheckContent } from "../../../../library/steps/_utils/math-check-content";
import { type Screen, type ScreenList, type StoredScreens } from "./schema";
import { type ScreenLesson } from "./snapshot";
import { type resolveVocabulary } from "./vocabulary";

type Added = {
  entry: Extract<ScreenList["screens"][number], { kind: string }>;
  screen: Screen;
  lesson: ScreenLesson;
  vocabulary: Awaited<ReturnType<typeof resolveVocabulary>>;
  newItems: StoredScreens["newItems"];
  allocatedScreen?: Screen;
  path: string;
  problems: string[];
};

function prepareNumeric({
  entry,
  screen,
  lesson,
  newItems,
  allocatedScreen,
  path,
  problems,
}: Added) {
  if (entry.numeric) {
    const result = toMathCheckContent({ input: entry.numeric, language: lesson.language });

    if (!result.ok || entry.kind !== "check" || entry.content) {
      problems.push(
        `${path}.numeric: supply a check with a valid numeric question. ${result.ok ? "Its content is derived from numeric." : result.problems.join(" ")}`,
      );
    } else if (screen.skillId) {
      const question = toScreenQuestion(result.item);

      if (question) {
        screen.itemId = allocatedScreen?.itemId ?? randomUUID();
        newItems.push({ id: screen.itemId, question, skillId: screen.skillId });
        screen.content = z.record(z.string(), z.json()).parse(result.content);
      }
    }
  }
}
export function prepareAdded(input: Added) {
  const { entry, screen, lesson, vocabulary, path, problems } = input;

  if (entry.skillId && !lesson.skillIds.includes(entry.skillId)) {
    problems.push(`${path}.skillId: choose a skill linked to this lesson.`);
  }

  if (!screen.skillId && isNotebookQuestionStep(screen)) {
    problems.push(`${path}.skillId: a question trains a skill. Link one to this lesson first.`);
  }

  screen.wordId = vocabulary.wordRefs.get(entry.word ?? "") ?? null;
  screen.sentenceId = vocabulary.sentenceRefs.get(entry.sentence ?? "") ?? null;
  const wordKind = entry.kind === "translation" || entry.kind === "vocabulary";
  const sentenceKind = entry.kind === "listening" || entry.kind === "reading";

  if (wordKind ? !screen.wordId : entry.word !== undefined) {
    problems.push(
      `${path}.word: vocabulary and translation require a final word ID or key. Omit word for other kinds.`,
    );
  }

  if (
    (sentenceKind || entry.sentence !== undefined) &&
    (!screen.sentenceId || !(sentenceKind || entry.kind === "spokenAnswer"))
  ) {
    problems.push(
      `${path}.sentence: use a final sentence ID or key for reading, listening or a linked spoken answer.`,
    );
  }

  prepareNumeric(input);
}
