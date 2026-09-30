import { readEvalImage, saveEvalImage } from "@/lib/image-files";
import { judgeImage } from "@/lib/image-judge";
import { defineScoreCategories } from "@/lib/score-categories";
import { type Task, type TaskScorer, getJudgeExpectations } from "@/lib/types";
import { generateCourseIcon } from "@zoonk/ai/tasks/v2/courses/icon";
import { type CourseIconInput, TEST_CASES } from "./test-cases";

const TASK_ID = "course-icon";

type CourseIconOutput = { imagePath: string; subject: string };

const scoreCategories = defineScoreCategories([
  {
    expectations:
      "The one object stands for the course's subject at a glance, using the description to pick the right meaning of the title. A generic or wrong object caps this at 5.",
    id: "subject",
    label: "Stands for the subject",
    weight: 40,
  },
  {
    expectations:
      "Matches the course icon style: exactly one centered object with a clean silhouette, smooth matte 3D with soft lighting and a subtle shadow, 2 to 4 colors, on a plain white background, like an app icon. A scene, several objects, props, a photo or a busy background caps this at 4.",
    id: "style",
    label: "Icon style",
    weight: 40,
  },
  {
    expectations: "No text at all: any letters, numbers or captions cap this at 3.",
    id: "text",
    label: "No text",
    weight: 20,
  },
]);

const scoreCourseIcon: TaskScorer = async ({ output, testCase }) => {
  const { imagePath, subject } = JSON.parse(output) as CourseIconOutput;

  return judgeImage({
    expectations: getJudgeExpectations(testCase),
    image: await readEvalImage(imagePath),
    scene: subject,
    scoreCategories,
  });
};

async function generate({
  caseId,
  description,
  model,
  title,
  useFallback,
}: CourseIconInput & { model: string; useFallback?: boolean }) {
  const { data, prompt, provenance } = await generateCourseIcon({
    description,
    model,
    title,
    useFallback,
  });

  const imagePath = await saveEvalImage({
    image: data.image.uint8Array,
    modelId: model,
    name: caseId,
    taskId: TASK_ID,
  });

  return {
    data: { imagePath, subject: `The icon of the course "${title}": ${description}` },
    systemPrompt: "",
    usage: {
      inputTokens: provenance.usage.inputTokens,
      outputTokens: provenance.usage.outputTokens,
    },
    userPrompt: prompt,
  };
}

/**
 * Draws course icons in the style courses always had (one matte 3D object on
 * white) and has a vision judge from another family check the object, the
 * style and that there's no text.
 */
export const courseIconTask: Task<CourseIconInput, CourseIconOutput> = {
  description: "Draw a course's icon: one matte 3D object on white that stands for the subject",
  generate,
  id: TASK_ID,
  name: "Course Icon",
  output: "image",
  score: scoreCourseIcon,
  scoreCategories,
  testCases: TEST_CASES,
};
