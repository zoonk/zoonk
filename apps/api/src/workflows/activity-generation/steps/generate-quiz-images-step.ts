import {
  type QuizQuestion,
  type SelectImageQuestion,
} from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { generateStepImage } from "@zoonk/core/steps/image";
import { streamStatus } from "../stream-status";
import { type LessonActivity } from "./get-lesson-activities-step";

type SelectImageOption = SelectImageQuestion["options"][number];
type SelectImageOptionWithUrl = SelectImageOption & { url?: string };
type SelectImageQuestionWithUrls = Omit<SelectImageQuestion, "options"> & {
  options: SelectImageOptionWithUrl[];
};

export type QuizQuestionWithUrls =
  | Exclude<QuizQuestion, SelectImageQuestion>
  | SelectImageQuestionWithUrls;

async function processSelectImageOption(
  option: SelectImageOption,
  orgSlug: string,
): Promise<SelectImageOptionWithUrl> {
  const { data: url, error } = await generateStepImage({
    orgSlug,
    prompt: option.prompt,
  });

  if (error) {
    return option;
  }

  return { ...option, url };
}

async function processSelectImageQuestion(
  question: SelectImageQuestion,
  orgSlug: string,
): Promise<SelectImageQuestionWithUrls> {
  const settledOptions = await Promise.allSettled(
    question.options.map((option) => processSelectImageOption(option, orgSlug)),
  );

  const optionsWithUrls = question.options.map((option, index): SelectImageOptionWithUrl => {
    const result = settledOptions[index];

    if (result?.status === "fulfilled") {
      return result.value;
    }

    return option;
  });

  return { ...question, options: optionsWithUrls };
}

function isSelectImageQuestion(question: QuizQuestion): question is SelectImageQuestion {
  return question.format === "selectImage";
}

export async function generateQuizImagesStep(
  activities: LessonActivity[],
  questions: QuizQuestion[],
): Promise<QuizQuestionWithUrls[]> {
  "use step";

  const activity = activities.find((a) => a.kind === "quiz");

  if (!activity || questions.length === 0) {
    return [];
  }

  if (activity.generationStatus === "completed") {
    return [];
  }

  await streamStatus({ status: "started", step: "generateQuizImages" });

  const orgSlug = activity.lesson.chapter.course.organization.slug;

  const settledResults = await Promise.allSettled(
    questions.map(async (question): Promise<QuizQuestionWithUrls> => {
      if (!isSelectImageQuestion(question)) {
        return question;
      }

      return processSelectImageQuestion(question, orgSlug);
    }),
  );

  const processedQuestions = questions.map((question, index): QuizQuestionWithUrls => {
    const result = settledResults[index];

    if (result?.status === "fulfilled") {
      return result.value;
    }

    return question;
  });

  await streamStatus({ status: "completed", step: "generateQuizImages" });

  return processedQuestions;
}
