import { type TestCase } from "@/lib/types";
import { type GenerateItemsParams } from "@zoonk/ai/tasks/v2/items/generate";

type GenerateItemsInput = Omit<GenerateItemsParams, "model" | "useFallback" | "reasoning">;

const ITEMS_PER_CASE = 3;

/** Shared with the placement-items eval, so both tasks see the same exam styles. */
export const ENEM = {
  name: "ENEM",
  optionCount: 5,
  style:
    "Texto-base curto com uma situação do cotidiano ou interdisciplinar, seguido de um comando claro; 5 alternativas (A a E) com apenas uma correta; distratores vêm de erros típicos; linguagem formal e contextualizada.",
};

/** Shared with the placement-items eval, so both tasks see the same exam styles. */
export const CEBRASPE = {
  name: "Cebraspe (concurso público)",
  style:
    "Cada item é uma afirmação sobre uma situação hipotética ou um conceito, julgada Certo ou Errado; um erro anula um acerto; as pegadinhas trocam conceitos, invertem exceções ou usam palavras absolutas.",
};

/** Shared with the placement-items eval, so both tasks see the same exam styles. */
export const SAT_MATH = {
  name: "Digital SAT Math",
  optionCount: 4,
  style:
    "A short context or equation, one direct question and 4 options (A to D), or a student-produced numeric response; calculator allowed; plain, precise wording with no trick phrasing.",
};

const AP_BIOLOGY = {
  name: "AP Biology",
  style:
    "multipleChoice (4 options): questions on data, experiments and models. essay: free-response questions with parts (a), (b), (c) and (d) using task verbs (identify, describe, explain, predict, justify), scored with point-based scoring guidelines.",
};

export const TEST_CASES: TestCase<unknown, GenerateItemsInput>[] = [
  {
    expectations: `One original AP Biology free-response question in English on enzyme activity, with lettered parts that use AP task verbs (identify, describe, explain, predict or justify) around an experiment or data. Its rubric must read like AP scoring guidelines: one row per point-bearing part, each description saying exactly what earns the points, and every row with whole points (1 to 3), adding up to a realistic total for a short free-response question (4 to 10). It must not copy a real College Board question.`,
    id: "en-ap-biology-free-response-essay",
    userInput: {
      count: 1,
      examFormat: AP_BIOLOGY,
      format: "essay",
      language: "en",
      level: "intermediate",
      skill: {
        description:
          "Explain how temperature, pH and inhibitors change an enzyme's shape and activity, using data from an experiment.",
        name: "Enzyme activity",
      },
    },
  },
  {
    expectations: `One ENEM essay prompt (redação) in Brazilian Portuguese: a theme with short motivating texts and the standard command for a dissertative-argumentative text with an intervention proposal. The rubric uses ENEM's five competencies, and since ENEM's grid doesn't give its rows points of their own, every row's points is null.`,
    id: "pt-enem-redacao-essay",
    userInput: {
      count: 1,
      examFormat: {
        ...ENEM,
        style: `${ENEM.style} Redação: texto dissertativo-argumentativo com proposta de intervenção, corrigido pelas cinco competências.`,
      },
      format: "essay",
      language: "pt",
      level: "intermediate",
      skill: {
        description:
          "Escrever um texto dissertativo-argumentativo com tese, argumentos com repertório e proposta de intervenção completa.",
        name: "Redação do ENEM",
      },
    },
  },
  {
    expectations: `ENEM-style Mathematics items in Brazilian Portuguese about successive percentage changes. Distractors should come from typical mistakes such as adding the percentages (10% + 20% = 30%) or applying the second change to the original value. Every item needs 5 options. People and towns come from CAST, a different person and town in each item, and no reason points at an option by its place ("a segunda", "alternativa B"): each names the option by what it says.`,
    id: "pt-enem-matematica-porcentagens-sucessivas",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: ENEM,
      format: "multipleChoice",
      language: "pt",
      level: "intermediate",
      skill: {
        description:
          "Calcular o efeito de aumentos e descontos percentuais aplicados um após o outro.",
        example: "Um produto sobe 10% e depois cai 10%: termina 1% mais barato.",
        name: "Aumentos e descontos percentuais sucessivos",
      },
    },
  },
  {
    expectations: `ENEM-style Mathematics items in Brazilian Portuguese on reading data from a table (comparing values across rows and years, finding the largest change). Each item gives its data in \`context\` as a GFM pipe table: a header row, a delimiter row such as |---|---:|, one row per line, set apart from the text around it by blank lines; \`question\` is only the command, with no table. Options start with the answer itself: an option whose text begins with a letter label ("A)", "(B)", "C.") must be penalized under realism, since the app shuffles options and labels them. Every item needs 5 options, and distractors come from misreading a row or column, or comparing totals instead of changes.`,
    id: "pt-enem-matematica-leitura-de-tabelas",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: ENEM,
      format: "multipleChoice",
      language: "pt",
      level: "beginner",
      skill: {
        description:
          "Ler e comparar dados apresentados em tabelas para responder a perguntas sobre valores, diferenças e variações.",
        example:
          "Numa tabela de viagens por modalidade em 2022 e 2023, o metrô passou de 180 para 210 mil viagens, o maior aumento.",
        name: "Leitura de dados em tabelas",
      },
    },
  },
  {
    expectations: `ENEM-style Natural Sciences items in US English about household electricity use (energy is power times time, in kWh, and its cost). Each item has a short everyday support text and 5 options; distractors come from typical mistakes such as not converting watts to kilowatts or minutes to hours, or using the wrong number of days. All learner-facing text must be in English.`,
    id: "en-enem-natural-sciences-electricity-consumption",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: ENEM,
      format: "multipleChoice",
      language: "en",
      level: "intermediate",
      skill: {
        description:
          "Calculate the energy a household appliance uses from its power and time of use, and what it costs.",
        example: "A 5,500 W electric shower used 10 minutes a day for 30 days uses 27.5 kWh.",
        name: "Household electricity consumption",
      },
    },
  },
  {
    expectations: `Cebraspe-style true/false items in Brazilian Portuguese on the principles of public administration (legalidade, impessoalidade, moralidade, publicidade, eficiência) under article 37 of the Brazilian Constitution. False items must hide one realistic trap. Check the legal accuracy of every statement.`,
    id: "pt-cebraspe-principios-administracao",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: CEBRASPE,
      format: "trueFalse",
      language: "pt",
      level: "intermediate",
      skill: {
        description:
          "Aplicar os princípios da administração pública do art. 37 da Constituição a situações concretas.",
        name: "Princípios da administração pública (LIMPE)",
      },
    },
  },
  {
    expectations: `Cebraspe-style true/false items in US English on annulment and revocation of administrative acts in Brazilian administrative law: the administration must annul its own illegal acts and may revoke lawful ones for reasons of convenience or opportunity, respecting acquired rights (STF Precedent 473; Law 9.784/1999, arts. 53 and 54). False items must hide one realistic trap, such as swapping annulment and revocation, saying revocation reaches illegal acts or that only the courts can annul. Check the legal accuracy of every statement.`,
    id: "en-cebraspe-annulment-revocation-administrative-acts",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: CEBRASPE,
      format: "trueFalse",
      language: "en",
      level: "intermediate",
      skill: {
        description:
          "Tell when Brazilian public administration must annul an administrative act and when it may revoke it, and what effects each has.",
        name: "Annulment and revocation of administrative acts",
      },
    },
  },
  {
    expectations: `Digital SAT Math multiple-choice items in English on solving linear equations in one variable. Four options each, with distractors from sign errors, distributing incorrectly or stopping one step early.`,
    id: "en-sat-math-linear-equations",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: SAT_MATH,
      format: "multipleChoice",
      language: "en",
      level: "intermediate",
      skill: {
        description:
          "Solve linear equations in one variable, including ones with parentheses and fractions.",
        name: "Solving linear equations in one variable",
      },
    },
  },
  {
    expectations: `Digital SAT Math student-produced-response items in English on percent change, stored as math data. The variable ranges must keep every new version sensible, the solution expression must compute the answer and the common mistakes must be real (for example dividing by the new value instead of the original).`,
    id: "en-sat-math-percent-change-numeric",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: SAT_MATH,
      format: "numeric",
      language: "en",
      level: "intermediate",
      skill: {
        description:
          "Compute the percent increase or decrease between an original and a new value.",
        name: "Percent change",
      },
    },
  },
  {
    expectations: `Everyday numeric practice in Brazilian Portuguese about the final price after a discount, for beginners, stored as math data. Situations should be everyday purchases in reais, with one step each.`,
    id: "pt-desconto-preco-final-numeric",
    userInput: {
      count: ITEMS_PER_CASE,
      format: "numeric",
      language: "pt",
      level: "beginner",
      skill: {
        description: "Calcular quanto se paga por um produto depois de um desconto percentual.",
        example: "Uma camiseta de R$ 80 com 25% de desconto sai por R$ 60.",
        name: "Preço final com desconto",
      },
    },
  },
  {
    expectations: `Short constructed-response items for a 10th-grade biology unit test in English on cellular respiration. Key points must be checkable one at a time (for example "glucose is broken down", "oxygen is used", "energy is stored as ATP"), and accepted answers only apply to short answers.`,
    id: "en-school-biology-cellular-respiration-typed",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: {
        name: "High school biology unit test",
        style:
          "Short constructed-response questions from a 10th-grade biology unit test: one or two sentences each, graded by key ideas.",
      },
      format: "typed",
      language: "en",
      level: "beginner",
      skill: {
        description:
          "Explain how cells release energy from glucose using oxygen, and where it happens.",
        name: "Cellular respiration",
      },
    },
  },
  {
    expectations: `Workplace multiple-choice items in English for a retail store manager learning to give specific, behavior-based feedback. Situations must be realistic store situations; wrong options should be common manager mistakes such as vague praise, judging personality instead of behavior or waiting weeks to give feedback.`,
    id: "en-work-behavior-feedback-retail",
    userInput: {
      count: ITEMS_PER_CASE,
      field: "retail store management",
      format: "multipleChoice",
      language: "en",
      level: "beginner",
      skill: {
        description:
          "Give feedback that names a specific behavior, its effect and what to do next, soon after it happens.",
        name: "Giving specific, behavior-based feedback",
      },
    },
  },
  {
    expectations: `Spoken-answer items in Brazilian Portuguese for nursing technicians practicing how to explain to a patient how to take a prescribed medicine safely. Answers must be possible aloud in under a minute, key points must be checkable ideas (dose, timing, what to avoid, when to call for help) and nothing may contradict standard patient-safety guidance.`,
    id: "pt-work-enfermagem-orientacao-medicamento-spoken",
    userInput: {
      count: ITEMS_PER_CASE,
      field: "enfermagem",
      format: "spoken",
      language: "pt",
      level: "beginner",
      skill: {
        description:
          "Orientar o paciente, em palavras simples, sobre dose, horário, cuidados e sinais de alerta de um medicamento prescrito.",
        name: "Orientar o paciente sobre o uso seguro de medicamentos",
      },
    },
  },
  {
    expectations: `Everyday multiple-choice practice in US English on percent change, set in a nurse's everyday work (a patient's weight, fluid intake, a ward's number of falls or beds from one month to the next), shared by every learner who works in nursing. The questions still test percent change: someone with the skill answers them without any nursing knowledge, and no answer depends on a clinical fact. Distractors come from real slips such as dividing by the new value or reporting the change instead of the percent. The math must be right, and nothing may contradict standard patient safety.`,
    id: "en-field-nursing-percent-change",
    userInput: {
      count: ITEMS_PER_CASE,
      field: "nursing",
      format: "multipleChoice",
      language: "en",
      level: "beginner",
      skill: {
        description:
          "Compute the percent increase or decrease between an original and a new value.",
        name: "Percent change",
      },
    },
  },
  {
    expectations: `Everyday multiple-choice practice in Brazilian Portuguese on finding a percentage of an amount, set in the everyday work of a law office (honorários de 20% sobre o valor da causa, multa de 2% sobre uma parcela, custas), shared by every learner who works in law. The questions still test the percentage: someone with the skill answers them without legal knowledge, and no answer depends on a legal rule. Amounts in reais written the Brazilian way (R$ 1.234,56), the math right and distractors from real slips (moving the decimal point, taking the percentage of the wrong amount).`,
    id: "pt-field-law-percentage",
    userInput: {
      count: ITEMS_PER_CASE,
      field: "law",
      format: "multipleChoice",
      language: "pt",
      level: "beginner",
      skill: {
        description: "Calcular quanto é uma porcentagem de um valor.",
        example: "20% de R$ 5.000,00 são R$ 1.000,00.",
        name: "Porcentagem de um valor",
      },
    },
  },
  {
    expectations: `ENEM-style Mathematics placement items in Brazilian Portuguese on comparing quantities by ratios (best buy, price per unit, speed), written the way ENEM asks them: a short support text and a command with 5 options. When the learner must work out a unit price or rate to choose, the options name only the choices ("O pacote de 6") and never print the computed values next to them ("O pacote de 6, a R$ 2,00 cada"): an option that shows the worked result gives the answer away and must be penalized under realism and skill fit. Questions asking for the value itself list candidate values. Even the easy item reads like an easy ENEM question, not a primary-school exercise.`,
    id: "pt-enem-placement-razoes-sem-resultado-nas-alternativas",
    userInput: {
      count: ITEMS_PER_CASE,
      examFormat: ENEM,
      format: "multipleChoice",
      language: "pt",
      level: "beginner",
      skill: {
        description:
          "Comparar grandezas por meio de razões, como preço por unidade, velocidade ou densidade, para decidir qual opção é mais vantajosa.",
        example: "6 maçãs por R$ 12,00 saem a R$ 2,00 cada; 4 por R$ 10,00 saem a R$ 2,50 cada.",
        name: "Comparar grandezas por razões",
      },
    },
  },
  {
    expectations: `Everyday multiple-choice items in US English on choosing the better deal by unit price. When a question asks which option is the better buy, the options name only the choices ("The 12-ounce jar") and never print the unit prices or other worked-out values next to them ("The 12-ounce jar, at $0.25 per ounce"): options that show the computed result give the answer away and must be penalized under realism and skill fit. Reasons explain the computation instead. Distractors come from real slips such as comparing total prices or dividing the wrong way.`,
    id: "en-best-buy-unit-price-no-worked-options",
    userInput: {
      count: ITEMS_PER_CASE,
      format: "multipleChoice",
      language: "en",
      level: "beginner",
      skill: {
        description: "Compare unit prices to decide which package or offer is the better buy.",
        example:
          "A 12-ounce jar for $3.00 costs $0.25 per ounce; an 18-ounce jar for $4.14 costs $0.23.",
        name: "Comparing unit prices",
      },
    },
  },
  {
    expectations: `School multiple-choice items in Brazilian Portuguese on telling plant cell organelles apart in a cell diagram. The skill is reading a diagram, so every question shows one as an \`image\` whose prompt describes the cell with every structure and label the answer depends on (for example a plant cell with a numbered arrow on one organelle), and whose question refers to "a figura" without describing what it shows. The picture never gives the answer away: no label names the structure the question asks for. A question with an image has \`visual\` null. Distractors are organelles students confuse (chloroplast and mitochondrion, cell wall and membrane, vacuole and nucleus).`,
    id: "pt-celula-vegetal-figure-image",
    userInput: {
      count: ITEMS_PER_CASE,
      format: "multipleChoice",
      language: "pt",
      level: "beginner",
      skill: {
        description:
          "Identificar, num esquema de célula vegetal, a parede celular, o cloroplasto, o vacúolo e o núcleo.",
        name: "Identificar organelas num esquema de célula vegetal",
      },
    },
  },
  {
    expectations: `Everyday multiple-choice items in US English on comparing and ordering negative numbers, a skill that needs no picture: every question has \`image\` null and asks in words, a table or a chart, and none points at a picture it doesn't show.`,
    id: "en-no-figure-needed-image-null",
    userInput: {
      count: ITEMS_PER_CASE,
      format: "multipleChoice",
      language: "en",
      level: "beginner",
      skill: {
        description: "Compare and order negative numbers, such as temperatures below zero.",
        name: "Ordering negative numbers",
      },
    },
  },
];
