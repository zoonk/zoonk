import { createStepStream } from "@/workflows/_shared/stream-status";
import { type QuizQuestion, type SelectImageQuestion } from "@zoonk/ai/tasks/activities/core/quiz";
import { generateStepImage } from "@zoonk/core/steps/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected } from "@zoonk/utils/settled";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";

export type QuizQuestionWithUrls =
  | Exclude<QuizQuestion, SelectImageQuestion>
  | (Omit<SelectImageQuestion, "options"> & {
      options: (SelectImageQuestion["options"][number] & { url?: string })[];
    });

type SelectImageOption = {
  feedback: string;
  isCorrect: boolean;
  prompt: string;
  url?: string;
};

function isSelectImageQuestion(question: QuizQuestion): question is SelectImageQuestion {
  return question.format === "selectImage";
}

/**
 * Generates images for selectImage options and returns updated options.
 */
async function generateOptionImages({
  language,
  options,
  orgSlug,
}: {
  language: string;
  options: SelectImageOption[];
  orgSlug?: string;
}): Promise<{ hadFailure: boolean; updatedOptions: SelectImageOption[] }> {
  const results = await Promise.allSettled(
    options.map(({ prompt }) => generateStepImage({ language, orgSlug, prompt })),
  );

  const updatedOptions = options.map((option, index) => {
    const result = results[index];
    if (result?.status === "fulfilled" && !result.value.error) {
      return { ...option, url: result.value.data };
    }
    return option;
  });

  return { hadFailure: rejected(results), updatedOptions };
}

/**
 * Generates images for quiz questions that use selectImage format.
 * Receives questions data directly from the content step (no DB reads).
 * Returns the questions with image URLs injected into selectImage options.
 * No DB writes — the save step handles persistence.
 */
export async function generateQuizImagesStep(
  activities: LessonActivity[],
  questions: QuizQuestion[],
  quizIndex = 0,
): Promise<QuizQuestionWithUrls[]> {
  "use step";

  const activity = findActivitiesByKind(activities, "quiz")[quizIndex];

  if (!activity || questions.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  const selectImageQuestions = questions.filter((question) => isSelectImageQuestion(question));

  if (selectImageQuestions.length === 0) {
    await stream.status({ status: "started", step: "generateQuizImages" });
    await stream.status({ status: "completed", step: "generateQuizImages" });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QuizQuestion is a subtype; url? is optional
    return questions as QuizQuestionWithUrls[];
  }

  await stream.status({ status: "started", step: "generateQuizImages" });

  const orgSlug = activity.lesson.chapter.course.organization?.slug;

  const imageResults = await Promise.allSettled(
    selectImageQuestions.map((question) =>
      generateOptionImages({
        language: activity.language,
        options: question.options,
        orgSlug,
      }),
    ),
  );

  const updatedSelectImageMap = new Map<number, SelectImageOption[]>();

  selectImageQuestions.forEach((question, idx) => {
    const result = imageResults[idx];
    if (result?.status === "fulfilled") {
      const questionIndex = questions.indexOf(question);
      updatedSelectImageMap.set(questionIndex, result.value.updatedOptions);
    }
  });

  const updatedQuestions: QuizQuestionWithUrls[] = questions.map((question, index) => {
    const updatedOptions = updatedSelectImageMap.get(index);
    if (updatedOptions && isSelectImageQuestion(question)) {
      return { ...question, options: updatedOptions };
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- non-selectImage questions pass through unchanged
    return question as QuizQuestionWithUrls;
  });

  await stream.status({ status: "completed", step: "generateQuizImages" });

  return updatedQuestions;
}
