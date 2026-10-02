import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type CiteMaterialInput,
  type ScreenMaterialRef,
  citeMaterial,
} from "@zoonk/ai/tasks/v2/material/cite";
import { type CiteMaterialExpected, TEST_CASES } from "./test-cases";

type CiteMaterialOutput = { citations: ScreenMaterialRef[] };

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function parseOutput(output: string): CiteMaterialOutput | null {
  try {
    return JSON.parse(output) as CiteMaterialOutput;
  } catch {
    return null;
  }
}

/**
 * Code scoring, screen by screen: the citation must be one of the right pages, or none when no
 * page supports the screen. A wrong page is the worst mistake: it sends the learner elsewhere.
 */
const scoreCiteMaterial: TaskScorer<CiteMaterialExpected> = ({ output, testCase }) => {
  const parsed = parseOutput(output);
  const expected = testCase.expected?.refs ?? [];

  if (!parsed) {
    return createFixedScore({ conclusion: "No citations", score: MIN_SCORE });
  }

  const misses = expected.flatMap((allowed, index) => {
    const ref = parsed.citations.find((citation) => citation.screen === index + 1)?.ref ?? null;
    // "none" among the right pages means leaving the screen without a citation is fine too.
    const isRight =
      ref === null ? allowed.length === 0 || allowed.includes("none") : allowed.includes(ref);

    return isRight ? [] : [`screen ${index + 1}: ${ref ?? "none"}`];
  });

  return createFixedScore({
    conclusion: misses.length === 0 ? "None" : `Wrong: ${misses.join(", ")}`,
    score: MIN_SCORE + (SCORE_RANGE * (expected.length - misses.length)) / expected.length,
  });
};

export const citeMaterialTask: Task<CiteMaterialInput, CiteMaterialOutput, CiteMaterialExpected> = {
  description:
    "Pick the page each lesson screen teaches from: the learner's own material, or the official documents a shared lesson's facts come from",
  generate: citeMaterial,
  id: "cite-material",
  name: "Cite Material",
  score: scoreCiteMaterial,
  testCases: TEST_CASES,
};
