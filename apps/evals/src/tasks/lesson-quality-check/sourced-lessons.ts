import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { SOURCED_LESSONS } from "../lesson-writer/sourced-lesson-specs";

/**
 * Hand-written lessons of goals built from official sources, with the passages the reviewer reads
 * as `SOURCES`. Clean copies match the sources; test cases plant a fact the sources contradict,
 * one that many people (and models) remember wrong, so only the source settles it.
 */

const taxDeadlines: WrittenLesson = {
  screens: [
    {
      image: null,
      kind: "hookGuess",
      options: [
        { isCorrect: false, text: "Yes, 6 more months to pay" },
        { isCorrect: true, text: "No, the tax is still due in April" },
      ],
      question:
        "You asked for more time to file your federal tax return. Do you also get more time to pay?",
      reveal:
        "No: the extra time is only for filing. The next screens show what that means for your money.",
      visual: null,
    },
    {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "Each spring you report last year's income to the federal government on a **tax return**. For your 2025 income, the return is due **April 15, 2026**. Filing late without asking for more time can cost you penalties.",
      title: "Your return is due in April",
      visual: null,
    },
    {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "If your forms aren't ready, send **Form 4868** by April 15 and you get 6 more months to file: until October 15, 2026. It doesn't delay paying: the tax you owe is still due April 15, 2026, or interest and penalties start.",
      title: "More time to file, not to pay",
      visual: null,
    },
    {
      context: null,
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason: "The extension only moves the filing date, so payment stays on April 15.",
          text: "April 15, 2026",
        },
        {
          isCorrect: false,
          reason:
            "Tempting, since that's her new filing date, but the extension doesn't move payment.",
          text: "October 15, 2026",
        },
        {
          isCorrect: false,
          reason:
            "Paying when she files means paying late: interest and penalties run from April 15.",
          text: "Whenever she files",
        },
      ],
      question: "Mia sent Form 4868 on April 10, 2026. By when must she pay the tax she owes?",
      visual: null,
    },
    {
      context:
        "Jamal freelances in Denver. On April 8, 2026 his receipts are still in a shoebox, but he knows he'll owe about $1,200.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason:
            "He gets until October 15 to file, and paying by April 15 avoids interest and penalties.",
          text: "Send Form 4868 and pay about $1,200 by April 15",
        },
        {
          isCorrect: false,
          reason:
            "The form gives him time to file, but paying in October adds interest and penalties.",
          text: "Send Form 4868 and pay in October",
        },
        {
          isCorrect: false,
          reason: "Without the form by April 15, both filing and paying are late.",
          text: "Wait and file everything by October 15",
        },
      ],
      question: "What should he do?",
      visual: null,
    },
  ],
  summary: [
    "Your federal tax return for 2025 is due April 15, 2026.",
    "Form 4868 gives you until October 15, 2026 to file, but the tax you owe is still due April 15.",
  ],
};

const estabilidade: WrittenLesson = {
  screens: [
    {
      image: null,
      kind: "hookGuess",
      options: [
        { isCorrect: false, text: "2 anos" },
        { isCorrect: true, text: "3 anos" },
        { isCorrect: false, text: "5 anos" },
      ],
      question:
        "Ana passou num concurso e tomou posse. Sem valer ponto: depois de quanto tempo trabalhando no cargo ela pode ganhar a garantia de não ser mandada embora?",
      reveal: "São 3 anos, e ainda falta uma condição. As próximas telas mostram qual.",
      visual: null,
    },
    {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "**Estabilidade** é a garantia de não ser mandado embora por decisão de um chefe. Quem entra por concurso ganha essa garantia depois de **três anos** trabalhando no cargo, e só se for aprovado numa avaliação do seu trabalho feita por uma comissão.",
      title: "Três anos e uma avaliação",
      visual: null,
    },
    {
      context: null,
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason:
            "Os três anos são só uma parte: sem a aprovação na avaliação, ele ainda não é estável.",
          text: "Não, falta ser aprovado na avaliação",
        },
        {
          isCorrect: false,
          reason:
            "É a pegadinha mais comum: o tempo sozinho não dá estabilidade, a avaliação é obrigatória.",
          text: "Sim, três anos bastam",
        },
        {
          isCorrect: false,
          reason: "Na posse ele só começa a contar os três anos.",
          text: "Sim, desde a posse",
        },
      ],
      question:
        "Pedro completou três anos no cargo, mas a comissão ainda não avaliou o trabalho dele. Ele já é estável?",
      visual: null,
    },
    {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "Estabilidade não é para sempre. Por falta ou mau desempenho, o servidor estável pode perder o cargo por uma decisão da Justiça da qual não cabe mais recurso, por um **processo administrativo** (uma apuração feita pelo próprio órgão, em que ele pode se defender) ou por avaliações periódicas do seu trabalho, também com direito a defesa.",
      title: "Estável também pode sair",
      visual: null,
    },
    {
      context:
        "Lúcia é servidora estável da prefeitura de Recife. O chefe dela acha que ela cometeu uma falta grave.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason:
            "Uma servidora estável só perde o cargo depois de um processo em que possa se defender.",
          text: "Não, antes vem um processo com direito a defesa",
        },
        {
          isCorrect: false,
          reason: "O chefe pode abrir o processo, mas não decide sozinho nem na hora.",
          text: "Sim, falta grave permite demitir na hora",
        },
        {
          isCorrect: false,
          reason:
            "Pagar indenização não substitui o processo: acusada de falta grave, ela só perde o cargo depois de um processo em que possa se defender.",
          text: "Sim, se a prefeitura pagar uma indenização",
        },
      ],
      question: "O chefe pode demiti-la no mesmo dia, sem processo?",
      visual: null,
    },
  ],
  summary: [
    "Quem entra por concurso fica estável depois de três anos no cargo, se for aprovado na avaliação do seu trabalho feita por uma comissão.",
    "Por falta ou mau desempenho, o servidor estável pode perder o cargo por decisão judicial definitiva, por processo administrativo ou por avaliação periódica, sempre com direito a defesa.",
  ],
};

export const SOURCED_BASE_LESSONS = {
  estabilidade: { ...SOURCED_LESSONS["pt-estabilidade"], lesson: estabilidade },
  taxDeadlines: { ...SOURCED_LESSONS["en-tax-deadlines"], lesson: taxDeadlines },
};
