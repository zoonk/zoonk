import { createStepStream } from "@/workflows/_shared/stream-status";
import { type QuizQuestion } from "@zoonk/ai/tasks/lessons/core/quiz";
import { generateStepImage } from "@zoonk/core/steps/image";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type QuizQuestionWithUrls } from "./_utils/save-core-lesson-content";
import { type LessonContext } from "./get-lesson-step";

type SelectImageQuestion = Extract<QuizQuestion, { format: "selectImage" }>;
type SelectImageOption = SelectImageQuestion["options"][number] & { url?: string };

function isSelectImageQuestion(question: QuizQuestion): question is SelectImageQuestion {
  return question.format === "selectImage";
}

async function generateOptionImages({
  context,
  options,
}: {
  context: LessonContext;
  options: SelectImageOption[];
}): Promise<SelectImageOption[]> {
  const urls = await Promise.all(
    options.map(async ({ prompt }) => {
      const { data, error } = await generateStepImage({
        language: context.language,
        orgSlug: context.chapter.course.organization?.slug,
        prompt,
      });

      if (error || !data) {
        throw error ?? new Error(`Image generation returned no URL for prompt: ${prompt}`);
      }

      return data;
    }),
  );

  return options.map((option, index) => ({ ...option, url: urls[index] }));
}

export async function generateQuizImagesStep({
  context,
  questions,
}: {
  context: LessonContext;
  questions: QuizQuestion[];
}): Promise<QuizQuestionWithUrls[]> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateQuizImages" });

  const updatedQuestions = await Promise.all(
    questions.map(async (question): Promise<QuizQuestionWithUrls> => {
      if (!isSelectImageQuestion(question)) {
        return question;
      }

      return {
        ...question,
        options: await generateOptionImages({ context, options: question.options }),
      };
    }),
  );

  await stream.status({ status: "completed", step: "generateQuizImages" });

  return updatedQuestions;
}
