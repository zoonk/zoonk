import { showInOrder } from "../../sessions/_utils/shown-order";
import {
  type PlayableActivityStep,
  type PlayableLanguageStep,
  type PlayableLibraryStep,
} from "../playable-lesson";

type Exercise = PlayableLanguageStep["exercise"];

function showExercise({ exercise, seed }: { exercise: Exercise; seed: string }): Exercise {
  const { content } = exercise;

  return {
    ...exercise,
    content:
      "options" in content
        ? { ...content, options: showInOrder({ items: content.options, seed: `${seed}:options` }) }
        : content,
    fillBlankOptions: showInOrder({ items: exercise.fillBlankOptions, seed: `${seed}:fillBlank` }),
    matchColumnsRightItems: showInOrder({
      items: exercise.matchColumnsRightItems,
      seed: `${seed}:matchColumns`,
    }),
    sentenceWordOptions: showInOrder({
      items: exercise.sentenceWordOptions,
      seed: `${seed}:sentenceWords`,
    }),
    translationOptions: showInOrder({
      items: exercise.translationOptions,
      seed: `${seed}:translation`,
    }),
    wordBankOptions: showInOrder({ items: exercise.wordBankOptions, seed: `${seed}:wordBank` }),
  };
}

function showActivity({
  seed,
  step,
}: {
  seed: string;
  step: PlayableActivityStep;
}): PlayableActivityStep {
  const { check } = step.content;

  const content =
    check.kind === "choice"
      ? {
          ...step.content,
          check: {
            ...check,
            options: showInOrder({ items: check.options, seed: `${seed}:check` }),
          },
        }
      : step.content;

  if (content.template !== "dialogueSimulator") {
    return { ...step, content };
  }

  const replies = showInOrder({ items: content.fields.replies, seed: `${seed}:replies` });
  return { ...step, content: { ...content, fields: { ...content.fields, replies } } };
}

function showScreen({ seed, step }: { seed: string; step: PlayableLibraryStep }) {
  if ("exercise" in step) {
    return { ...step, exercise: showExercise({ exercise: step.exercise, seed }) };
  }

  if (step.kind === "activity") {
    return showActivity({ seed, step });
  }

  if (step.kind === "challenge") {
    const nodes = step.content.nodes.map((node) => ({
      ...node,
      choices: showInOrder({ items: node.choices, seed: `${seed}:${node.id}` }),
    }));

    return { ...step, content: { ...step.content, nodes } };
  }

  if (step.kind === "spokenAnswer" && step.listening) {
    return {
      ...step,
      listening: showExercise({ exercise: step.listening, seed: `${seed}:listening` }),
    };
  }

  if (step.kind === "check") {
    const options = showInOrder({ items: step.content.options, seed });
    return { ...step, content: { ...step.content, options } };
  }

  if (step.kind === "hook" && step.content.variant === "guess") {
    const options = showInOrder({ items: step.content.options, seed });
    return { ...step, content: { ...step.content, options } };
  }

  return step;
}

/** One sitting of a lesson runs until the learner's next finish, so a replay after finishing gets new orders. */
export function getLessonSitting({
  finishedAt,
  lessonId,
  userId,
}: {
  finishedAt: Date | null;
  lessonId: string;
  userId: string;
}): string {
  return `lesson:${userId}:${lessonId}:${finishedAt?.getTime() ?? "first"}`;
}

/**
 * Lays out what a screen offers to pick from in the order one sitting shows it. Answers name an
 * option or a word, never a place, so a sitting can move them and a replay tests what they say.
 */
export function showStepOptions({
  seed,
  step,
}: {
  seed: string;
  step: PlayableLibraryStep;
}): PlayableLibraryStep {
  return showScreen({ seed: `${seed}:${step.id}`, step });
}
