import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type PlayerQuestionContext } from "../player-context";
import { type LessonQuestionApiError } from "./lesson-question-api";

function sortQuestions(questions: LessonQuestionResource[]) {
  return questions.toSorted(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
}

export function updateQuestionById({
  questions,
  questionId,
  update,
}: {
  questions: LessonQuestionResource[];
  questionId: string;
  update: (question: LessonQuestionResource) => LessonQuestionResource;
}): LessonQuestionResource[] {
  return questions.map((question) => (question.id === questionId ? update(question) : question));
}

export function mergeCreatedQuestion({
  question,
  questions,
}: {
  question: LessonQuestionResource;
  questions: LessonQuestionResource[];
}) {
  const existingQuestion = questions.some((candidate) => candidate.id === question.id);

  if (!existingQuestion) {
    return sortQuestions([...questions, question]);
  }

  return updateQuestionById({
    questionId: question.id,
    questions,
    update: (current) => getLatestQuestion({ current, latest: question }),
  });
}

export function mergeEarlierQuestions({
  currentQuestions,
  earlierQuestions,
}: {
  currentQuestions: LessonQuestionResource[];
  earlierQuestions: LessonQuestionResource[];
}) {
  const currentQuestionIds = new Set(currentQuestions.map((question) => question.id));

  const newEarlierQuestions = earlierQuestions.filter(
    (question) => !currentQuestionIds.has(question.id),
  );

  return sortQuestions([...newEarlierQuestions, ...currentQuestions]);
}

export function mergeLatestQuestions({
  currentQuestions,
  latestQuestions,
}: {
  currentQuestions: LessonQuestionResource[];
  latestQuestions: LessonQuestionResource[];
}) {
  const currentQuestionById = new Map(currentQuestions.map((question) => [question.id, question]));
  const latestQuestionIds = new Set(latestQuestions.map((question) => question.id));

  const retainedEarlierQuestions = currentQuestions.filter(
    (question) => !latestQuestionIds.has(question.id),
  );

  return sortQuestions([
    ...retainedEarlierQuestions,
    ...latestQuestions.map((question) =>
      getLatestQuestion({ current: currentQuestionById.get(question.id), latest: question }),
    ),
  ]);
}

/** Completed answers are immutable; an older HTTP response must never replace one with a running snapshot. */
function getLatestQuestion({
  current,
  latest,
}: {
  current: LessonQuestionResource | undefined;
  latest: LessonQuestionResource;
}) {
  if (!current) {
    return latest;
  }

  if (
    (current.status === "completed" && latest.status !== "completed") ||
    current.updatedAt > latest.updatedAt
  ) {
    return current;
  }

  if (
    current.status === "running" &&
    latest.status === "running" &&
    current.answer &&
    !latest.answer
  ) {
    return { ...latest, answer: current.answer };
  }

  return latest;
}

export function isSameDraftContext({
  current,
  next,
}: {
  current: PlayerQuestionContext;
  next: PlayerQuestionContext;
}) {
  if (current.kind !== next.kind) {
    return false;
  }

  if (current.kind === "lesson" || next.kind === "lesson") {
    return true;
  }

  if (current.kind === "answer" && next.kind === "answer") {
    return (
      current.step.id === next.step.id &&
      JSON.stringify(current.selectedAnswer) === JSON.stringify(next.selectedAnswer)
    );
  }

  return current.kind === "step" && next.kind === "step" && current.step.id === next.step.id;
}

export function getReconciledAnswerError({
  answerError,
  questions,
}: {
  answerError: { questionId: string; reason: LessonQuestionApiError } | null;
  questions: LessonQuestionResource[];
}) {
  if (!answerError) {
    return null;
  }

  const question = questions.find((candidate) => candidate.id === answerError.questionId);
  return question?.status === "failed" ? answerError : null;
}
