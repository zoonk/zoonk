import { generateQuizContentStep } from "../steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "../steps/generate-quiz-images-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveQuizLessonStep } from "../steps/save-quiz-lesson-step";

export async function quizLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const content = await generateQuizContentStep(context);
  const questions = await generateQuizImagesStep({
    context,
    questions: content.questions,
  });

  await saveQuizLessonStep({ context, questions });
}
