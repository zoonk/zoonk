import { type TestCase } from "@/lib/types";
import { type ExamIdentityExpected, type ExamIdentityInput } from "./task";

/** The language is the one the learner named the exam in. */
function pair(
  id: string,
  language: string,
  request: ExamIdentityInput["request"],
  candidate: ExamIdentityInput["candidate"],
  same: boolean,
): TestCase<ExamIdentityExpected, ExamIdentityInput> {
  return {
    expected: { same: same ? "true" : "false" },
    id,
    language,
    userInput: { candidate, request },
  };
}

const exam = (
  name: string,
  country: string,
  board: string | null = null,
  role: string | null = null,
) => ({ board, country, name, role });

export const TEST_CASES: TestCase<ExamIdentityExpected, ExamIdentityInput>[] = [
  pair(
    "enem-full-name",
    "pt",
    exam("Exame Nacional do Ensino Médio", "BR", "INEP"),
    exam("ENEM", "BR", "INEP"),
    true,
  ),
  pair("enem-with-year", "pt", exam("ENEM 2027", "BR"), exam("ENEM", "BR", "INEP"), true),
  pair(
    "tcdf-same-role",
    "pt",
    exam("Concurso TCDF", "BR", "Cebraspe", "Analista Administrativo de Controle Externo"),
    exam(
      "Tribunal de Contas do Distrito Federal",
      "BR",
      "Cebraspe",
      "Analista Administrativo de Controle Externo",
    ),
    true,
  ),
  pair(
    "tcdf-other-role",
    "pt",
    exam("Concurso TCDF", "BR", "Cebraspe", "Auditor de Controle Externo"),
    exam("Concurso TCDF", "BR", "Cebraspe", "Analista Administrativo de Controle Externo"),
    false,
  ),
  pair(
    "oab-phases",
    "pt",
    exam("OAB 2ª fase", "BR", "FGV"),
    exam("OAB Exame de Ordem Unificado", "BR", "FGV", "1ª fase"),
    false,
  ),
  pair(
    "oab-same-phase",
    "pt",
    exam("OAB", "BR", "FGV", "Primeira fase"),
    exam("OAB Exame de Ordem Unificado", "BR", "FGV", "1ª fase"),
    true,
  ),
  pair(
    "oab-unnamed-phase-is-first",
    "pt",
    exam("OAB", "BR"),
    exam("OAB Exame de Ordem Unificado", "BR", "FGV", "1ª fase"),
    true,
  ),
  pair(
    "oab-candidate-without-phase",
    "pt",
    exam("OAB Exame de Ordem Unificado", "BR", "FGV", "1ª fase"),
    exam("OAB Exame de Ordem Unificado", "BR", "FGV"),
    false,
  ),
  pair(
    "oab-second-phase-areas",
    "pt",
    exam("OAB", "BR", "FGV", "2ª fase - Direito Penal"),
    exam("OAB Exame de Ordem Unificado", "BR", "FGV", "2ª fase - Direito Civil"),
    false,
  ),
  pair(
    "sat-vs-psat",
    "en",
    exam("PSAT/NMSQT", "US", "College Board"),
    exam("SAT", "US", "College Board"),
    false,
  ),
  pair(
    "abitur-states",
    "de",
    exam("Abitur Bayern", "DE"),
    exam("Abitur Baden-Württemberg", "DE"),
    false,
  ),
  pair(
    "en-oab-in-english",
    "en",
    exam("Brazilian bar exam", "BR"),
    exam("Exame de Ordem Unificado OAB", "BR", "FGV"),
    true,
  ),
  pair(
    "pt-fuvest-vs-enem",
    "pt",
    exam("vestibular da Fuvest", "BR", "Fuvest"),
    exam("ENEM", "BR", "INEP"),
    false,
  ),
  pair(
    "bac-translation",
    "en",
    exam("French baccalaureate", "FR"),
    exam("Baccalauréat général", "FR", "Ministère de l'Éducation nationale"),
    true,
  ),
];
