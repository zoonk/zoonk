import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { defineScoreCategories } from "@/lib/score-categories";
import { type Task, type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type ImageSceneInput, generateImageScene } from "@zoonk/ai/tasks/images/scene";
import { type ImageScene } from "@zoonk/ai/tasks/images/scene-schema";
import { getString } from "@zoonk/utils/json";
import { readCriteria } from "../plain-language-criterion";
import { type ImageSceneExpected, TEST_CASES } from "./test-cases";

type ImageSceneOutput = Awaited<ReturnType<typeof generateImageScene>>["data"];

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/gu;

const scoreCategories = defineScoreCategories([
  {
    expectations:
      "The scene shows what the screen says, so the picture teaches the idea at a glance. Objects are concrete and drawable, never abstract words. Nothing contradicts the screen text.",
    id: "teaches",
    label: "Teaches the idea",
    weight: 35,
  },
  {
    expectations:
      "One focal object, at most two small supporting objects, one idea. An overloaded request is cut down to the screen's idea. A screen that names the parts of a whole (the lobes of the brain, the stages of a cycle, places on a map) gets the whole with those parts, and nothing the screen doesn't name.",
    id: "simplicity",
    label: "One idea, simply",
    weight: 25,
  },
  {
    expectations:
      "Labels appear only when a word, number or price makes the idea readable, and a whole shown with its parts labels each part its screen names; each is at most four words, in the lesson's language, spelled right, and numbers match the screen exactly. None for language courses. Labels that repeat the obvious or act as captions cap this at 6.",
    id: "labels",
    label: "Labels",
    readerExpectations:
      "Labels appear only when a word, number or price makes the idea readable, and a whole shown with its parts labels each part its screen names; each is at most four words, in the lesson's language, spelled right, and numbers match the screen exactly. None for language courses. Labels that repeat the obvious or act as captions clutter the picture.",
    weight: 25,
  },
  {
    expectations:
      "Every field except label texts is written in English, and each label's target says where it goes (next to an object, or on it).",
    id: "fields",
    label: "English fields and placement",
    weight: 15,
  },
]);

function checkLabelCount({ expected, scene }: { expected: ImageSceneExpected; scene: ImageScene }) {
  if (expected.labels === "none" && scene.labels.length > 0) {
    return "This case needs an image without text, but the scene has labels.";
  }

  if (expected.labels === "some" && scene.labels.length === 0) {
    return "The prices or numbers on this screen need labels, but the scene has none.";
  }

  return null;
}

function checkLayout({ layout, scene }: { layout: ImageScene["layout"]; scene: ImageScene }) {
  return scene.layout === layout
    ? null
    : `This screen needs the ${layout} layout, but the scene's layout is ${scene.layout}.`;
}

function checkLabelNumbers({
  scene,
  screenText,
}: {
  scene: ImageScene;
  screenText: string | null;
}) {
  const screenNumbers = new Set(screenText?.match(NUMBER_PATTERN));
  const labelNumbers = scene.labels.flatMap((label) => label.text.match(NUMBER_PATTERN) ?? []);
  const unknown = labelNumbers.filter((value) => !screenNumbers.has(value));

  return unknown.length > 0 ? `Label numbers not on the screen: ${unknown.join(", ")}.` : null;
}

const checkScene: TaskCodeChecks<ImageSceneExpected> = ({ output, testCase }) => {
  const scene = JSON.parse(output) as ImageScene;
  const expected = testCase.expected ?? { labels: "any" };
  const screenText = getString(testCase.userInput, "screenText");

  const labelProblems = [
    checkLabelCount({ expected, scene }),
    checkLabelNumbers({ scene, screenText }),
  ].filter((problem) => problem !== null);

  const layoutProblem = expected.layout ? checkLayout({ layout: expected.layout, scene }) : null;
  const total = expected.layout ? 3 : 2;

  const problems = [...labelProblems, ...(layoutProblem ? [layoutProblem] : [])];

  return {
    criteria: [
      ...(labelProblems.length > 0 ? ["labels"] : []),
      ...(layoutProblem ? ["teaches"] : []),
    ],
    judgedOutput: output,
    passed: total - problems.length,
    problems,
    total,
  };
};

const scoreImageScene: TaskScorer<ImageSceneExpected> = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkScene({ output: value, testCase }),
    output,
    scoreCategories,
    testCase,
  });

export const imageSceneTask: Task<ImageSceneInput, ImageSceneOutput, ImageSceneExpected> = {
  codeChecks: checkScene,
  criteria: readCriteria(scoreCategories),
  description: "Plan one lesson picture as a structured scene",
  generate: generateImageScene,
  id: "image-scene",
  name: "Image scene",
  priorities: {
    comparison: {
      criteria: { fields: "counts", labels: "counts", simplicity: "counts", teaches: "counts" },
      preference: "separates",
      trade: COMPARISON_TRADES.shared,
      weights: { labels: 3, teaches: 3 },
    },
    distribution: "shared",
    first: "cost",
    reads: "An image model draws from the scene",
    reason: "It costs little next to the image itself, so the cheaper of two equal models",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreImageScene,
  scoreCategories,
  testCases: TEST_CASES,
};
