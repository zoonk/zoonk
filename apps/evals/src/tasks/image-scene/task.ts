import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { defineScoreCategories } from "@/lib/score-categories";
import { type Task, type TaskScorer, type TestCase } from "@/lib/types";
import { type ImageSceneInput, generateImageScene } from "@zoonk/ai/tasks/v2/images/scene";
import { type ImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { getString } from "@zoonk/utils/json";
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
      "One focal object, at most two small supporting objects, one idea. An overloaded request is cut down to the screen's idea. No charts, maps or diagrams with many parts.",
    id: "simplicity",
    label: "One idea, simply",
    weight: 25,
  },
  {
    expectations:
      "Labels appear only when a word, number or price makes the idea readable; each is at most four words, in the lesson's language, spelled right, and numbers match the screen exactly. None for language courses. Labels that repeat the obvious or act as captions cap this at 6.",
    id: "labels",
    label: "Labels",
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

function checkScene(testCase: TestCase<ImageSceneExpected>) {
  return (output: string): CodeCheckResult => {
    const scene = JSON.parse(output) as ImageScene;
    const expected = testCase.expected ?? { labels: "any" };
    const screenText = getString(testCase.userInput, "screenText");

    const results = [
      checkLabelCount({ expected, scene }),
      checkLabelNumbers({ scene, screenText }),
    ];

    const problems = results.filter((problem) => problem !== null);

    return {
      judgedOutput: output,
      passed: results.length - problems.length,
      problems,
      total: results.length,
    };
  };
}

const scoreImageScene: TaskScorer<ImageSceneExpected> = ({ output, testCase }) =>
  scoreWithCodeChecks({ check: checkScene(testCase), output, scoreCategories, testCase });

/**
 * Turns a writer's image request into a structured scene. Code checks catch
 * text where none belongs and numbers that don't match the screen; the judge
 * reads whether the scene teaches, stays simple and labels well.
 */
export const imageSceneTask: Task<ImageSceneInput, ImageSceneOutput, ImageSceneExpected> = {
  description: "Plan one lesson picture as a structured scene",
  generate: generateImageScene,
  id: "image-scene",
  name: "Image Scene",
  score: scoreImageScene,
  scoreCategories,
  testCases: TEST_CASES,
};
