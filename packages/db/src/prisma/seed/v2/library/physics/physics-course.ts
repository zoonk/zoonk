import { t } from "../../_utils/localize";
import { type SeedCourse } from "../types";
import { classicalChapters, quantumChapters } from "./deep-chapters";
import { physicsItems } from "./items";
import { mathChapters } from "./math-chapters";
import { mathSkills } from "./math-skills";
import { overviewChapters } from "./overview-chapters";
import { overviewSkills } from "./overview-skills";
import { classicalSkills, quantumSkills } from "./physics-skills";
import { physicsReviewItems } from "./review-items";

/**
 * The huge-goal course: quantum physics from scratch, through the math and classical physics it
 * needs. Its overview band also serves learners who only want to understand the ideas.
 */
export const physicsCourse: SeedCourse = {
  category: "science",
  chapters: [...overviewChapters, ...mathChapters, ...classicalChapters, ...quantumChapters],
  description: t(
    "From the math physics uses to the atom, light and entanglement, one short lesson at a time.",
    "Da matemática que a física usa ao átomo, à luz e ao emaranhamento, uma lição curta de cada vez.",
  ),
  format: "core",
  items: [...physicsItems, ...physicsReviewItems],
  key: "quantum-physics",
  languages: ["en", "pt"],
  skills: [...overviewSkills, ...mathSkills, ...classicalSkills, ...quantumSkills],
  slug: t("quantum-physics-from-scratch", "fisica-quantica-do-zero-pt"),
  title: t("Quantum physics from scratch", "Física quântica do zero"),
};
