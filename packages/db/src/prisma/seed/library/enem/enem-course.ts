import { t } from "../../_utils/localize";
import { type SeedCourse } from "../types";
import { enemAreaItems } from "./enem-area-items";
import { enemChallengeItems } from "./enem-challenge-items";
import { enemAreaChapters, enemMathChapters } from "./enem-chapters";
import { enemDayOneItems } from "./enem-day-one-items";
import { enemExamSkills } from "./enem-exam-skills";
import { enemMathItems } from "./enem-math-items";
import { enemAreaSkills, enemMathSkills } from "./enem-skills";

export const enemCourse: SeedCourse = {
  category: "exams",
  chapters: [...enemMathChapters, ...enemAreaChapters],
  description: t(
    "Brazil's national high school exam, topic by topic, in the order that pays off most.",
    "O Exame Nacional do Ensino Médio, assunto por assunto, na ordem que mais rende.",
  ),
  format: "exam",
  items: [...enemMathItems, ...enemAreaItems, ...enemChallengeItems, ...enemDayOneItems],
  key: "enem",
  languages: ["en", "pt"],
  skills: [...enemMathSkills, ...enemAreaSkills, ...enemExamSkills],
  slug: t("enem", "enem-pt"),
  title: t("ENEM", "ENEM"),
};
