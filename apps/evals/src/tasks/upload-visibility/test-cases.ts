import { type TestCase } from "@/lib/types";
import { type UploadVisibilityParams } from "@zoonk/ai/tasks/v2/research/upload-visibility";
import { type UploadVisibilityExpected } from "./task";

/** The language is the document's. */
function uploadCase({
  fileName,
  id,
  language,
  text,
  visibility,
}: {
  fileName: string;
  id: string;
  language: string;
  text: string;
  visibility: "public" | "private";
}): TestCase<UploadVisibilityExpected, UploadVisibilityParams> {
  return {
    expected: { visibility },
    id,
    language,
    userInput: { document: { file: null, images: [], text, title: fileName, url: null }, fileName },
  };
}

export const TEST_CASES: TestCase<UploadVisibilityExpected, UploadVisibilityParams>[] = [
  uploadCase({
    fileName: "edital_tcdf_2026.pdf",
    id: "exam-notice",
    language: "pt",
    text: "TRIBUNAL DE CONTAS DO DISTRITO FEDERAL (TCDF)\nCONCURSO PÚBLICO PARA O PROVIMENTO DE VAGAS E A FORMAÇÃO DE CADASTRO DE RESERVA NO CARGO DE ANALISTA ADMINISTRATIVO DE CONTROLE EXTERNO\nEDITAL Nº 1 – TCDF/ANACE, DE 8 DE JULHO DE 2026\nO PRESIDENTE DO TRIBUNAL DE CONTAS DO DISTRITO FEDERAL, no uso de suas atribuições legais, torna pública a realização de concurso público...\n1.1 O concurso público será regido por este edital e executado pelo Centro Brasileiro de Pesquisa em Avaliação e Seleção e de Promoção de Eventos (Cebraspe).",
    visibility: "public",
  }),
  uploadCase({
    fileName: "lei-14790.pdf",
    id: "law",
    language: "pt",
    text: "Presidência da República\nCasa Civil\nSecretaria Especial para Assuntos Jurídicos\nLEI Nº 14.790, DE 29 DE DEZEMBRO DE 2023\nDispõe sobre a modalidade lotérica denominada apostas de quota fixa...\nO PRESIDENTE DA REPÚBLICA Faço saber que o Congresso Nacional decreta e eu sanciono a seguinte Lei:",
    visibility: "public",
  }),
  uploadCase({
    fileName: "enem_2025_caderno_azul_dia1.pdf",
    id: "past-exam",
    language: "pt",
    text: "EXAME NACIONAL DO ENSINO MÉDIO\nENEM 2025\n1º DIA\nCADERNO 1 AZUL\nLINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS E REDAÇÃO\nLEIA ATENTAMENTE AS INSTRUÇÕES SEGUINTES\nMinistério da Educação - Inep",
    visibility: "public",
  }),
  uploadCase({
    fileName: "Aula 07 - Enzimas.pptx",
    id: "class-slides",
    language: "pt",
    text: "Bioquímica I – Prof. Ricardo Menezes\nAula 7: Enzimas e cinética de Michaelis-Menten\nTurma 2026/1 – Farmácia\nObjetivos da aula\n- Definir Km e Vmax\n- Interpretar o gráfico de Lineweaver-Burk\nLista de exercícios 3 no Moodle",
    visibility: "private",
  }),
  uploadCase({
    fileName: "prova_bioquimica_2025.pdf",
    id: "school-exam",
    language: "pt",
    text: "Universidade Federal – Departamento de Bioquímica\nPROVA 2 – BIOQUÍMICA I – 2025/2\nNome: ______________ Matrícula: ________\nQuestão 1 (2,0 pontos) Explique o efeito de um inibidor competitivo sobre Km e Vmax.",
    visibility: "private",
  }),
  uploadCase({
    fileName: "meu resumo direito constitucional.md",
    id: "personal-notes",
    language: "pt",
    text: "# Resumo DC – art. 5º\n- direitos individuais: vida, liberdade, igualdade\n- cai muito no Cebraspe!! revisar remédios constitucionais\n- dúvida: HC x MS?",
    visibility: "private",
  }),
  uploadCase({
    fileName: "Q3 onboarding playbook.docx",
    id: "work-document",
    language: "en",
    text: "Acme Corp – Internal\nSales Onboarding Playbook Q3 2026\nConfidential – do not distribute\nOwner: Maria Lopes (maria.lopes@acme.example)\n1. Our pricing tiers and discount rules",
    visibility: "private",
  }),
  uploadCase({
    fileName: "SAT_Practice_Test_4.pdf",
    id: "prep-company-book",
    language: "en",
    text: "Kaplan SAT Prep Plus 2027\nPractice Test 4\nCopyright © Kaplan, Inc. All rights reserved. No part of this book may be reproduced...",
    visibility: "private",
  }),
];
