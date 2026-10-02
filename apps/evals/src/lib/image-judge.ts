import { Output, generateText } from "ai";
import imageJudgePrompt from "./image-judge-system-prompt.md";
import { calculateScore } from "./score-calculation";
import { formatScoreCategories, resolveCategoryScores } from "./score-categories";
import {
  type ScoreCategory,
  type TaskScoreResult,
  categorizedScoreSchema,
  toTokenUsage,
} from "./types";

/**
 * The image models under test are OpenAI's, so a judge from another family
 * reads the images: it shouldn't share their blind spots.
 */
const IMAGE_JUDGE_MODEL_ID = "anthropic/claude-opus-5.5";

/** Scores one generated image against its scene with a vision judge and a weighted rubric. */
export async function judgeImage({
  expectations,
  image,
  scene,
  scoreCategories,
}: {
  expectations: string;
  image: Uint8Array;
  scene: string;
  scoreCategories: ScoreCategory[];
}): Promise<TaskScoreResult> {
  const prompt = `
    **Expectations**
    ${expectations}

    **Score categories**
    Score every category independently. A strength in one category must not erase a weakness in another.

    ${formatScoreCategories(scoreCategories)}

    **Scene**
    ${scene}
  `;

  const { output, usage } = await generateText({
    instructions: imageJudgePrompt,
    messages: [
      {
        content: [
          { text: prompt, type: "text" },
          { data: image, mediaType: "image/webp", type: "file" },
        ],
        role: "user",
      },
    ],
    model: IMAGE_JUDGE_MODEL_ID,
    output: Output.object({ schema: categorizedScoreSchema }),
  });

  const categoryScores = resolveCategoryScores({
    categories: scoreCategories,
    judgeScores: output.categoryScores,
  });

  return {
    categoryScores,
    judge: { modelId: IMAGE_JUDGE_MODEL_ID, usage: toTokenUsage(usage) },
    score: calculateScore({ categoryScores, steps: output.steps }),
    steps: output.steps,
  };
}
