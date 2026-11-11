import { type TestCase } from "@/lib/types";
import { type FindCourseWeightsParams } from "@zoonk/ai/tasks/research/find-course-weights";
import { type FindCourseWeightsExpected } from "./task";

type FindCourseWeightsCase = TestCase<FindCourseWeightsExpected, FindCourseWeightsParams>;

const TODAY = "2026-10-07";

const ENEM_PARTS = [
  "Linguagens, Códigos e suas Tecnologias",
  "Ciências Humanas e suas Tecnologias",
  "Ciências da Natureza e suas Tecnologias",
  "Matemática e suas Tecnologias",
  "Redação",
];

export const TEST_CASES: FindCourseWeightsCase[] = [
  {
    // UFMG weighs every part 1 for Medicina in its SISU 2026 adhesion term.
    expected: { status: "found", weights: [1, 1, 1, 1, 1] },
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
    // UFRJ's 2026 SISU notice, Annex IV, Rio de Janeiro row: essay 4, natural sciences 4,
    // humanities 1, languages 2, mathematics 2.
    expected: { status: "found", weights: [2, 1, 4, 2, 4] },
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
    expected: { status: "unknown" },
    id: "pt-enem-instituicao-inexistente",
    userInput: {
      course: "Direito",
      exam: "ENEM",
      institution: "Faculdade Imaginária de Estudos Avançados de Pirapora do Norte",
      subjects: ENEM_PARTS,
      today: TODAY,
    },
  },
  {
    // UFPE Resolution 12/2025, annex, Campus Recife: essay 2, natural sciences 3, humanities 1,
    // languages 2, mathematics 2. Caruaru's Medicina weighs differently, so the campus is named.
    expected: { status: "found", weights: [2, 1, 3, 2, 2] },
    id: "en-enem-medicine-ufpe-recife",
    language: "en",
    userInput: {
      course: "Medicine",
      exam: "ENEM",
      institution: "UFPE, Recife campus",
      subjects: ENEM_PARTS,
      today: TODAY,
    },
  },
  {
    // UFPE Resolution 12/2025, annex, Campus Recife: essay 3, natural sciences 1, humanities 2,
    // languages 3, mathematics 1.
    expected: { status: "found", weights: [3, 2, 1, 1, 3] },
    id: "pt-enem-direito-ufpe-recife",
    userInput: {
      course: "Direito",
      exam: "ENEM",
      institution: "UFPE, campus Recife",
      subjects: ENEM_PARTS,
      today: TODAY,
    },
  },
];
