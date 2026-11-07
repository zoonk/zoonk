import { type ExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";

/** The law block of the notice, which lists five disciplines and internal rules as one subject. */
export const TJSP_LAW_BLUEPRINT: ExamOutline = {
  name: "Concurso do Tribunal de Justiça de São Paulo, Escrevente Técnico Judiciário (Vunesp)",
  notes: ["Format: questões objetivas de múltipla escolha com cinco alternativas."],
  subjects: [
    {
      group: "BLOCO II: Conhecimentos em Direito",
      name: "Conhecimentos em Direito",
      questions: 30,
      topics: [
        "1. DIREITO PENAL: Código Penal - artigos 293 a 305; 307; 308; 311-A; 312 a 317; 319 a 333; 336 e 337; 339 a 347; 357 e 359",
        "2. DIREITO PROCESSUAL PENAL: Código de Processo Penal - artigos 251 a 258; 261 a 267; 274; 351 a 372; 394 a 497; 531 a 538; 541 a 548; 574 a 667 e Lei n.º 9.099 de 26.09.1995 (artigos 60 a 83; 88 e 89)",
        "3. DIREITO PROCESSUAL CIVIL",
        "3.1. Código de Processo Civil - artigos 144 a 155; 188 a 275; 294 a 311 e do 318 a 538; 994 a 1026",
        "3.2. Lei n.º 9.099 de 26.09.1995 (artigos 3º ao 19) e",
        "3.3. Lei n.º 12.153 de 22/12/2009",
        "4. DIREITO CONSTITUCIONAL: Constituição Federal – Título II - Capítulos I, II e III; e Título III - Capítulo VII com Seções I e II; e também o artigo 92",
        "5. DIREITO ADMINISTRATIVO",
        "5.1. Estatuto dos Funcionários Públicos Civis do Estado de São Paulo (Lei n.º 10.261/68) - artigos 1º a 86; 171 a 175; 239 a 323 e",
        "5.2. Lei Federal n.º 8.429/92 (Lei de Improbidade Administrativa)",
        "6. LEGISLAÇÃO INTERNA",
        "6.1. Resolução TJSP nº 850/2021 (Regulamenta o teletrabalho no âmbito do Tribunal de Justiça do Estado de São Paulo e dá outras providências)",
        "6.2. Resolução TJSP nº 963/2025 (Dispõe sobre a governança e utilização do sistema eproc nas unidades do Poder Judiciário do Estado de São Paulo e dá outras providências)",
        "6.2. Lei Complementar n° 1.111/ 2010 (Institui o Plano de Cargos e Carreiras dos servidores do Tribunal de Justiça do Estado de São Paulo e dá providências correlatas)",
        "6.3. Regimento Interno do Tribunal de Justiça",
        "6.4. Normas da Corregedoria Geral da Justiça",
        "Tomo I – Capítulo II: Seção I – subseções I e II",
        "Tomo I - Capítulo III: Seções I, II, V, VI, VII",
        "Tomo I - Capítulo III: Seção VIII – subseções I, II e III",
        "Tomo I – Capítulo III: Seções IX a XIX",
        "Tomo I – Capítulo XI: Seções I, IV e V",
        "Tomo I – Capítulo XI: Seção I a VII",
      ],
      weight: null,
    },
  ],
  topicFrequency: [],
};
