import { readEvalImage, saveEvalImage } from "@/lib/image-files";
import { judgeImage } from "@/lib/image-judge";
import { defineScoreCategories } from "@/lib/score-categories";
import { type Task, type TaskScorer, getJudgeExpectations } from "@/lib/types";
import { generateLessonImage } from "@zoonk/ai/tasks/v2/images/generate";
import { describeImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { getImagePalette } from "@zoonk/ai/tasks/v2/images/style";
import { type LessonImageInput, TEST_CASES } from "./test-cases";

const TASK_ID = "lesson-image";

type LessonImageOutput = { imagePath: string; scene: string };

const scoreCategories = defineScoreCategories([
  {
    expectations:
      "The image shows the scene's idea at a glance: the focal object is there and recognizable, and the relation, comparison or motion reads correctly. Nothing contradicts the scene.",
    id: "teaches",
    label: "Shows the idea",
    weight: 40,
  },
  {
    expectations:
      "Matches the house style: a portrait picture with flat shapes, rounded corners, soft shadows, one focal object (or one whole with its parts) with lots of space, a plain white background, two to four soft colors and one accent. A photo, 3D render, poster, infographic, dark or busy background caps this at 4.",
    id: "style",
    label: "House style",
    weight: 35,
  },
  {
    expectations:
      "Text follows the case: only the requested labels, spelled right, legible and next to what they name, or no text at all when none is requested. Any unrequested or garbled text caps this at 4.",
    id: "text",
    label: "Text",
    weight: 25,
  },
]);

const scoreLessonImage: TaskScorer = async ({ output, testCase }) => {
  const { imagePath, scene } = JSON.parse(output) as LessonImageOutput;

  return judgeImage({
    expectations: getJudgeExpectations(testCase),
    image: await readEvalImage(imagePath),
    scene,
    scoreCategories,
  });
};

async function generate({
  caseId,
  category,
  language,
  model,
  scene,
  useFallback,
}: LessonImageInput & { model: string; useFallback?: boolean }) {
  const { data, prompt, provenance } = await generateLessonImage({
    language,
    model,
    palette: getImagePalette(category),
    scene,
    useFallback,
  });

  const imagePath = await saveEvalImage({
    image: data.image.uint8Array,
    modelId: model,
    name: caseId,
    taskId: TASK_ID,
  });

  return {
    data: { imagePath, scene: describeImageScene(scene) },
    systemPrompt: "",
    usage: {
      inputTokens: provenance.usage.inputTokens,
      outputTokens: provenance.usage.outputTokens,
    },
    userPrompt: prompt,
  };
}

/**
 * Draws fixed scenes with the style block and has a vision judge from another
 * family grade the idea, the house style and the text.
 */
export const lessonImageTask: Task<LessonImageInput, LessonImageOutput> = {
  description: "Draw one lesson picture from a structured scene in the house style",
  generate,
  id: TASK_ID,
  name: "Lesson Image",
  output: "image",
  score: scoreLessonImage,
  scoreCategories,
  testCases: TEST_CASES,
};
