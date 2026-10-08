import { t } from "../../_utils/localize";
import { type SeedCourse } from "../types";
import { enemAreaItems } from "./enem-area-items";
import { enemAreaChapters, enemMathChapters } from "./enem-chapters";
import { enemMathItems } from "./enem-math-items";
import { enemAreaSkills, enemMathSkills } from "./enem-skills";

/**
 * The exam course: ENEM topic by topic, weighted by how often the exam asks each one. Its items
 * are written in the exam's format, with a misconception behind every wrong option.
 */
export const enemCourse: SeedCourse = {
  category: "society",
  chapters: [...enemMathChapters, ...enemAreaChapters],
  description: t(
    "Brazil's national high school exam, topic by topic, in the order that pays off most.",
    "O Exame Nacional do Ensino Médio, assunto por assunto, na ordem que mais rende.",
  ),
  format: "exam",
  items: [...enemMathItems, ...enemAreaItems],
  key: "enem",
  languages: ["en", "pt"],
  skills: [...enemMathSkills, ...enemAreaSkills],
  slug: t("enem", "enem-pt"),
  title: t("ENEM", "ENEM"),
};
