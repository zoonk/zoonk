import { readEvalImage, saveEvalImage } from "@/lib/image-files";
import { judgeImage } from "@/lib/image-judge";
import { calculateScore } from "@/lib/score-calculation";
import { defineScoreCategories } from "@/lib/score-categories";
import { type Task, type TaskScorer, getJudgeExpectations } from "@/lib/types";
import { checkMindMapImage } from "@zoonk/ai/tasks/v2/mind-maps/check";
import { generateMindMapImage } from "@zoonk/ai/tasks/v2/mind-maps/image";
import { type MindMapStructure, listMindMapTexts } from "@zoonk/ai/tasks/v2/mind-maps/schema";
import { type MindMapImageInput, TEST_CASES } from "./test-cases";

const TASK_ID = "mind-map-image";

type MindMapImageOutput = { imagePath: string; language: string; structure: MindMapStructure };

/** The words count as much as the rest together: a misspelled map can't ship, however pretty. */
const TEXT_WEIGHT = 100;
const MAX_SCORE = 10;
const MIN_SCORE = 1;
const POINTS_PER_WRONG_WORD = 2;

const scoreCategories = defineScoreCategories([
  {
    expectations:
      "Every part of the structure is on the map where it belongs: the title in the center, the central idea, each numbered branch with its sentence, bullets and a small sketch, the comparison when there is one and the summary line. Lines join branches to the center and nothing overlaps or is cut off.",
    id: "layout",
    label: "Every part, clearly laid out",
    weight: 50,
  },
  {
    expectations:
      "A friendly hand-drawn study sheet: neat marker lettering, one soft color per branch, small colored-pencil sketches, on a clean plain white background filling the image. A photo, 3D, a tinted or textured paper, a desk or frame, or clutter caps this at 5.",
    id: "style",
    label: "Mind-map style",
    weight: 25,
  },
  {
    expectations:
      "The text reads easily at full size: big enough, high contrast, never crammed. Sketches carry no words or numbers.",
    id: "legibility",
    label: "Legibility",
    weight: 25,
  },
]);

/**
 * The production text check (every word read back and compared with the structure) as its own
 * category: full marks when it passes, two points off for each word that isn't the map's.
 */
async function scoreText({
  image,
  language,
  structure,
}: MindMapImageOutput & { image: Uint8Array }) {
  const { data } = await checkMindMapImage({
    image: { data: image, mediaType: "image/webp" },
    language,
    structure,
  });

  return {
    categoryId: "text",
    label: "Text matches the structure",
    reasoning: data.passed
      ? `Every word matches the structure (${listMindMapTexts({ language, structure }).length} texts).`
      : data.problems.join(" "),
    score: data.passed
      ? MAX_SCORE
      : Math.max(MIN_SCORE, MAX_SCORE - POINTS_PER_WRONG_WORD * Math.max(1, data.unknown.length)),
    weight: TEXT_WEIGHT,
  };
}

const scoreMindMapImage: TaskScorer = async ({ output, testCase }) => {
  const parsed = JSON.parse(output) as MindMapImageOutput;
  const image = await readEvalImage(parsed.imagePath);

  const [judged, text] = await Promise.all([
    judgeImage({
      expectations: getJudgeExpectations(testCase),
      image,
      scene: JSON.stringify(parsed.structure, null, 2),
      scoreCategories,
    }),
    scoreText({ ...parsed, image }),
  ]);

  const categoryScores = [...(judged.categoryScores ?? []), text];

  return {
    ...judged,
    categoryScores,
    score: calculateScore({ categoryScores, steps: judged.steps }),
  };
};

async function generate({
  caseId,
  language,
  model,
  structure,
  useFallback,
}: MindMapImageInput & { model: string; useFallback?: boolean }) {
  const { data, prompt, provenance } = await generateMindMapImage({
    language,
    model,
    structure,
    useFallback,
  });

  const imagePath = await saveEvalImage({
    image: data.image,
    modelId: model,
    name: caseId,
    taskId: TASK_ID,
  });

  return {
    data: { imagePath, language, structure },
    systemPrompt: "",
    usage: {
      inputTokens: provenance.usage.inputTokens,
      outputTokens: provenance.usage.outputTokens,
    },
    userPrompt: prompt,
  };
}

/**
 * Draws real chapters' mind maps from fixed structures and scores them on what matters most, the
 * words (the production check reads every one back), then the layout and style with a vision judge
 * from another family.
 */
export const mindMapImageTask: Task<MindMapImageInput, MindMapImageOutput> = {
  description: "Draw a chapter's mind map with every word exactly as its structure says",
  generate,
  id: TASK_ID,
  name: "Mind Map Image",
  output: "image",
  score: scoreMindMapImage,
  scoreCategories,
  testCases: TEST_CASES,
};
