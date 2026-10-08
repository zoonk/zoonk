import { type TestCase } from "@/lib/types";
import { type FindCourseWeightsParams } from "@zoonk/ai/tasks/v2/research/find-course-weights";
import { type FindCourseWeightsExpected } from "./task";

type FindCourseWeightsCase = TestCase<FindCourseWeightsExpected, FindCourseWeightsParams>;

const TODAY = "2026-10-07";

/** ENEM's parts as its notice names them (re-read 7 Oct 2026). */
const ENEM_PARTS = [
  "Linguagens, Códigos e suas Tecnologias",
  "Ciências Humanas e suas Tecnologias",
  "Ciências da Natureza e suas Tecnologias",
  "Matemática e suas Tecnologias",
  "Redação",
];

/** A medical course never weighs the humanities above the natural sciences. */
const MEDICINE_ORDER = [{ part: 3, than: 2 }];

/**
 * Federal universities publish each course's SISU weights, so Medicina at UFMG has them; a made-up
 * institution has none, and then "unknown" is the only right answer.
 */
export const TEST_CASES: FindCourseWeightsCase[] = [
  {
    expected: { atLeast: MEDICINE_ORDER, status: "found" },
    id: "pt-enem-medicina-ufmg",
    userInput: {
      course: "Medicina",
      exam: "ENEM",
      institution: "UFMG",
      subjects: ENEM_PARTS,
      today: TODAY,
    },
  },
  {
    expected: { atLeast: MEDICINE_ORDER, status: "found" },
    id: "en-enem-medicine-ufrj",
    language: "en",
    userInput: {
      course: "Medicine",
      exam: "ENEM",
      institution: "Federal University of Rio de Janeiro (UFRJ)",
      subjects: ENEM_PARTS,
      today: TODAY,
    },
  },
  {
    expected: { atLeast: [], status: "unknown" },
    id: "pt-enem-instituicao-inexistente",
    userInput: {
      course: "Direito",
      exam: "ENEM",
      institution: "Faculdade Imaginária de Estudos Avançados de Pirapora do Norte",
      subjects: ENEM_PARTS,
      today: TODAY,
    },
  },
];
