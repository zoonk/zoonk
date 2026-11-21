import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { scoreImageEdges } from "@/lib/image-edges";
import { readEvalImage, saveEvalImage } from "@/lib/image-files";
import { judgeImage } from "@/lib/image-judge";
import { calculateScore } from "@/lib/score-calculation";
import { defineScoreCategories } from "@/lib/score-categories";
import { type Task, type TaskScorer, getJudgeExpectations } from "@/lib/types";
import { checkMindMapImage } from "@zoonk/ai/tasks/mind-maps/check";
import { generateMindMapImage } from "@zoonk/ai/tasks/mind-maps/image";
import { type MindMapStructure } from "@zoonk/ai/tasks/mind-maps/schema";
import { type ReadCriterion } from "../plain-language-criterion";
import { type MindMapImageInput, TEST_CASES } from "./test-cases";

const TASK_ID = "mind-map-image";

type MindMapImageOutput = { imagePath: string; language: string; structure: MindMapStructure };

const TEXT_WEIGHT = 100;
const MAX_SCORE = 10;
const MIN_SCORE = 1;
const POINTS_PER_WRONG_WORD = 2;

const layoutCriterion = {
  expectations:
    "Every part of the structure is on the map where it belongs: the title in the center, the central idea, each numbered branch with its sentence, bullets and a small sketch, the comparison when there is one and the summary line. Lines join the branches to the center, and nothing overlaps or is cut off. Notice a missing, repeated or cut-off part, branches out of order, and a sketch that shows something other than what its branch says. A missing part is a hole in what the learner reviews.",
  id: "layout",
  label: "Every part, clearly laid out",
} satisfies ReadCriterion;

const textCriterion = {
  expectations:
    "Every word is lettered exactly as the structure says, in its language, with its accents and symbols. Read the whole map letter by letter, the small bullets and the comparison too, and compare it with the structure. Notice a misspelled, changed, invented or missing word, and a symbol drawn so it reads as another (a ÷ that looks like +). The learner reviews from this sheet, so a wrong word is learned as written.",
  id: "text",
  label: "Every word as written",
} satisfies ReadCriterion;

const styleCriterion = {
  expectations:
    "A friendly hand-drawn study sheet: neat marker lettering, one soft color per branch, small colored-pencil sketches, on plain white paper that fills the whole image. Notice a photo, 3D, cream, beige or any other tinted or textured paper (compare the corners with pure white), a desk, a frame or border, and clutter. The map sits on a white lesson screen, so a tinted sheet looks like a photo pasted onto the page.",
  id: "style",
  label: "Mind-map style",
} satisfies ReadCriterion;

const legibilityCriterion = {
  expectations:
    "The text reads easily at full size: big enough, high contrast and never crammed, and sketches carry no words or numbers. Notice lettering too small or faint to read, text squeezed against a border or another box, and words inside sketches. A word the learner can't read is a part of the map they lose.",
  id: "legibility",
  label: "Legibility",
} satisfies ReadCriterion;

const scoreCategories = defineScoreCategories([
  { ...layoutCriterion, weight: 50 },
  {
    ...styleCriterion,
    expectations: `${styleCriterion.expectations} A photo, 3D, a tinted or textured paper, a desk or frame, or clutter caps this at 5.`,
    weight: 25,
  },
  { ...legibilityCriterion, weight: 25 },
]);

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

  const wrongWords = data.unknown.length + data.missing.length;

  return {
    categoryId: "text",
    label: "Text matches the structure",
    reasoning: data.problems.join(" ") || "Every word matches the structure.",
    score: Math.max(MIN_SCORE, MAX_SCORE - POINTS_PER_WRONG_WORD * wrongWords),
    weight: TEXT_WEIGHT,
  };
}

const scoreMindMapImage: TaskScorer = async ({ output, testCase }) => {
  const parsed = JSON.parse(output) as MindMapImageOutput;
  const image = await readEvalImage(parsed.imagePath);

  const [judged, text, edges] = await Promise.all([
    judgeImage({
      expectations: getJudgeExpectations(testCase),
      image,
      scene: JSON.stringify(parsed.structure, null, 2),
      scoreCategories,
    }),
    scoreText({ ...parsed, image }),
    scoreImageEdges(image),
  ]);

  const categoryScores = [...(judged.categoryScores ?? []), text, edges];

  return {
    ...judged,
    categoryScores,
    score: calculateScore({ categoryScores, steps: judged.steps }),
  };
};

async function generate({
  language,
  model,
  runId,
  structure,
  useFallback,
}: MindMapImageInput & { model: string; runId: string; useFallback?: boolean }) {
  const { data, prompt, provenance } = await generateMindMapImage({
    language,
    model,
    structure,
    useFallback,
  });

  const imagePath = await saveEvalImage({
    image: data.image,
    modelId: model,
    runId,
    taskId: TASK_ID,
  });

  return {
    data: { imagePath, language, structure },
    systemPrompt: "",
    usage: {
      images: provenance.usage.images,
      inputTokens: provenance.usage.inputTokens,
      outputTokens: provenance.usage.outputTokens,
    },
    userPrompt: prompt,
  };
}

export const mindMapImageTask: Task<MindMapImageInput, MindMapImageOutput> = {
  criteria: [layoutCriterion, textCriterion, styleCriterion, legibilityCriterion],
  description: "Draw a chapter's mind map with every word exactly as its structure says",
  generate,
  id: TASK_ID,
  name: "Mind map image",
  output: "image",
  priorities: {
    comparison: {
      criteria: { layout: "counts", legibility: "counts", style: "counts", text: "counts" },
      preference: "separates",
      trade: COMPARISON_TRADES.shared,
      weights: { layout: 3, text: 3 },
    },
    distribution: "shared",
    first: "cost",
    reads: "A learner sees the chapter's mind map",
    reason: "Low image quality lettered every word right for about a cent",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreMindMapImage,
  scoreCategories,
  testCases: TEST_CASES,
};
