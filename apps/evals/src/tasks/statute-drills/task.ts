import { type Task } from "@/lib/types";
import {
  type StatuteDrillParams,
  generateStatuteDrills,
} from "@zoonk/ai/tasks/items/statute-drills";
import { readCriteria } from "../plain-language-criterion";
import { STATUTE_DRILLS_SCORE_CATEGORIES } from "./score-categories";
import { scoreStatuteDrills } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const statuteDrillsTask: Task<
  StatuteDrillParams,
  Awaited<ReturnType<typeof generateStatuteDrills>>["data"]
> = {
  criteria: readCriteria(STATUTE_DRILLS_SCORE_CATEGORIES),
  description:
    "Turn statute text into drills on its letter (Cebraspe right/wrong, FGV multiple choice, fill-in-the-blank): code checks (cited articles, gaps that rebuild the text, false statements that differ from it, balance, format mix, count, item checks), then a judge on legal accuracy and board-style traps",
  generate: generateStatuteDrills,
  id: "statute-drills",
  name: "Statute drills",
  priorities: {
    comparison: {
      criteria: {
        boardTraps: "counts",
        coverage: "counts",
        legalAccuracy: "disqualifies",
        styleAndLanguage: "counts",
      },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner practices law drills",
    reason: "Written once per law and shared, so the right law outweighs cost",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreStatuteDrills,
  scoreCategories: STATUTE_DRILLS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
