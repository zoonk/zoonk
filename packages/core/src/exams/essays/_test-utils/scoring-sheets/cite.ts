/**
 * Test data only. Every text is a short paraphrase of the board's public document named here, and
 * a citation's passage repeats that paraphrase, never the document's own words.
 */
const SOURCES = {
  "ap-history-rubrics":
    "College Board, AP History Long Essay Question rubric and scoring notes (2023 rubrics)",
  "aqa-history-mark-scheme":
    "AQA, A-level History 7042 mark schemes, generic mark scheme for 25-mark essay questions",
  "cebraspe-cgu-2026-notice":
    "Cebraspe, CGU 2026 notice (Edital nº 1), items 9.7.5 and 9.7.6 on the discursive test",
  "enem-cartilha":
    "Inep, A redação do Enem: cartilha do participante (the five competences' level grids and the reasons for a zero)",
  "enem-correction-manuals":
    "Inep, Manual de correção da redação do Enem, modules on Competências II and V (repertoire, tangent, the proposal's five elements, the conditional proposal)",
  "enem-notice":
    "Inep, Enem notice (edital), section on how the redação is marked by two examiners",
  "fgv-oab-notice": "FGV, Exame de Ordem Unificado notice, sections 3.5 and 4.2",
  "fgv-oab-standard":
    "FGV, XV Exame de Ordem Unificado, Direito do Trabalho, 2ª fase: Questão 1 and its Distribuição dos Pontos",
  "ielts-band-descriptors":
    "IELTS (British Council, IDP, Cambridge), Writing Task 2 band descriptors, public version",
  "ielts-scoring":
    "IELTS, How IELTS is scored: the four criteria count equally and scores are reported in whole and half bands",
} as const;

type SourceId = keyof typeof SOURCES;

type Cited = { citation: { passage: string; sourceId: string }; text: string };

export function from(sourceId: SourceId) {
  function rule(text: string): Cited;
  function rule<Fields extends object>(text: string, fields: Fields): Cited & Fields;

  function rule(text: string, fields?: object) {
    return { citation: { passage: text, sourceId }, text, ...fields };
  }

  return rule;
}
