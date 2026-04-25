import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type QuizQuestion, type SelectImageQuestion } from "@zoonk/ai/tasks/activities/core/quiz";
import { generateStepImage } from "@zoonk/core/steps/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
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
}): Promise<SelectImageOption[]> {
  const results = await Promise.all(
    options.map(async ({ prompt }) => {
      const { data, error } = await generateStepImage({ language, orgSlug, prompt });

      if (error || !data) {
        throw error ?? new Error(`Image generation returned no URL for prompt: ${prompt}`);
      }

      return data;
    }),
  );

  return options.map((option, index) => ({ ...option, url: results[index] }));
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

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  const selectImageQuestions = questions.filter((question) => isSelectImageQuestion(question));

  if (selectImageQuestions.length === 0) {
    await stream.status({ status: "started", step: "generateQuizImages" });
    await stream.status({ status: "completed", step: "generateQuizImages" });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QuizQuestion is a subtype; url? is optional
    return questions as QuizQuestionWithUrls[];
  }

  await stream.status({ status: "started", step: "generateQuizImages" });

  const orgSlug = activity.lesson.chapter.course.organization?.slug;

  const imageResults = await Promise.all(
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
    if (result) {
      const questionIndex = questions.indexOf(question);
      updatedSelectImageMap.set(questionIndex, result);
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
