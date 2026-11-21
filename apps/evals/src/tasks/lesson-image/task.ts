import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { scoreImageEdges } from "@/lib/image-edges";
import { readEvalImage, saveEvalImage } from "@/lib/image-files";
import { judgeImage } from "@/lib/image-judge";
import { calculateScore } from "@/lib/score-calculation";
import { defineScoreCategories } from "@/lib/score-categories";
import { type Task, type TaskScorer, getJudgeExpectations } from "@/lib/types";
import { generateLessonImage } from "@zoonk/ai/tasks/images/generate";
import { describeImageScene } from "@zoonk/ai/tasks/images/scene-schema";
import { getImagePalette } from "@zoonk/ai/tasks/images/style";
import { type ReadCriterion } from "../plain-language-criterion";
import { type LessonImageInput, TEST_CASES } from "./test-cases";

const TASK_ID = "lesson-image";

type LessonImageOutput = { imagePath: string; scene: string };

const teachesCriterion = {
  expectations:
    "A beginner who sees only this picture understands the scene's idea: the focal object is the one the scene asks for and is recognizable, and the relation, comparison or motion reads the way the scene says. Notice a wrong or swapped object, a missing part of the idea, an arrow or line pointing the wrong way, and any detail that contradicts the scene or the facts of the subject. A picture that shows the wrong thing teaches the wrong thing.",
  id: "teaches",
  label: "Shows the idea",
} satisfies ReadCriterion;

const styleCriterion = {
  expectations:
    "The lesson house style: a landscape picture with flat shapes, rounded corners and soft shadows; one focal object, or one whole with its parts, with plenty of empty space; thin dashed lines for movement; plain white edge to edge; two to four soft colors and one accent. Notice a photo, a 3D render, a poster, an infographic, several panels, clutter, a dark, tinted or busy background, or a frame of any width. A picture off the style looks out of place in the lesson and pulls the eye away from the idea.",
  id: "style",
  label: "House style",
} satisfies ReadCriterion;

const textCriterion = {
  expectations:
    "Only the scene's labels, each spelled exactly as given, legible and next to what it names, and no text at all when the scene lists none. Read every word letter by letter, including small and faint ones, and compare it with the scene. Notice a misspelled or garbled label, a label on the wrong part, a missing label and any other words. A wrong label teaches the learner the wrong word or the wrong name for a part.",
  id: "text",
  label: "Text",
} satisfies ReadCriterion;

const scoreCategories = defineScoreCategories([
  {
    ...teachesCriterion,
    expectations: `${teachesCriterion.expectations} A wrong focal object or an idea that reads wrong caps this at 3.`,
    weight: 40,
  },
  {
    ...styleCriterion,
    expectations: `${styleCriterion.expectations} A photo, 3D render, poster, infographic, several panels, a dark, tinted or busy background, or a frame caps this at 4.`,
    weight: 35,
  },
  {
    ...textCriterion,
    expectations: `${textCriterion.expectations} Any unrequested, misspelled or garbled text caps this at 4.`,
    weight: 25,
  },
]);

const scoreLessonImage: TaskScorer = async ({ output, testCase }) => {
  const { imagePath, scene } = JSON.parse(output) as LessonImageOutput;

  const image = await readEvalImage(imagePath);

  const [judged, edges] = await Promise.all([
    judgeImage({ expectations: getJudgeExpectations(testCase), image, scene, scoreCategories }),
    scoreImageEdges(image),
  ]);

  const categoryScores = [...(judged.categoryScores ?? []), edges];

  return {
    ...judged,
    categoryScores,
    score: calculateScore({ categoryScores, steps: judged.steps }),
  };
};

async function generate({
  category,
  language,
  model,
  runId,
  scene,
  useFallback,
}: LessonImageInput & { model: string; runId: string; useFallback?: boolean }) {
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
    runId,
    taskId: TASK_ID,
  });

  return {
    data: { imagePath, scene: describeImageScene(scene) },
    systemPrompt: "",
    usage: {
      images: provenance.usage.images,
      inputTokens: provenance.usage.inputTokens,
      outputTokens: provenance.usage.outputTokens,
    },
    userPrompt: prompt,
  };
}

export const lessonImageTask: Task<LessonImageInput, LessonImageOutput> = {
  criteria: [teachesCriterion, textCriterion, styleCriterion],
  description: "Draw one lesson picture from a structured scene in the house style",
  generate,
  id: TASK_ID,
  name: "Lesson image",
  output: "image",
  priorities: {
    comparison: {
      criteria: { style: "counts", teaches: "counts", text: "counts" },
      preference: "separates",
      trade: COMPARISON_TRADES.shared,
      weights: { teaches: 3, text: 3 },
    },
    distribution: "shared",
    first: "cost",
    reads: "A learner sees the picture on a lesson screen",
    reason: "Low quality is enough for flat scenes, and higher quality costs several times more",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreLessonImage,
  scoreCategories,
  testCases: TEST_CASES,
};
