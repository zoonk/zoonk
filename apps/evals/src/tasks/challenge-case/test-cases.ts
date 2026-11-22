import { type OptionalCountry, type TestCase } from "@/lib/types";
import { type ChallengeCaseParams } from "@zoonk/ai/tasks/challenge/schema";

type ChallengeCaseInput = Omit<
  OptionalCountry<ChallengeCaseParams>,
  "analytics" | "model" | "problems" | "reasoning" | "useFallback"
>;

export const TEST_CASES: TestCase<unknown, ChallengeCaseInput>[] = [
  {
    expectations: `A marketing or e-commerce analyst judging an A/B test before a meeting, where a colleague wants to ship now. The strong path checks whether the gap could be chance and how many visitors each version had, uses the AI or a data colleague to test significance, and explains the result in plain words. Numbers must be consistent (a small gap on a small sample shouldn't be called significant). Must not teach that a single day of data proves a winner.`,
    id: "en-ab-test-work",
    userInput: {
      chapterDescription: "Tell a real difference from chance in experiments like A/B tests.",
      chapterTitle: "Hypothesis testing",
      courseTitle: "Statistics",
      language: "en",
      level: "beginner",
      skills: [
        {
          description: "Decide whether a gap between two groups could be chance.",
          name: "Tell a real difference from chance",
        },
        {
          description: "Know how many observations a comparison needs.",
          name: "Choose a sample size",
        },
        {
          description: "Explain a test result to people who aren't data people.",
          name: "Explain a test result",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A light "E se?" scenario in Brazilian Portuguese about energy coming in packets (quanta), for example "E se a luz não viesse em pacotes?" or a curious situation with a lamp, a solar panel or a camera. Two decisions per path, playful, no formulas, no jargon beyond "quantum" explained simply. Must be scientifically correct at an overview level (no claims that quantum effects are magic or that observation needs a conscious observer).`,
    id: "pt-quantum-what-if",
    userInput: {
      chapterDescription: "A energia da luz e da matéria vem em pacotes chamados quanta.",
      chapterTitle: "O que é um quantum",
      courseTitle: "Física quântica",
      language: "pt",
      level: "overview",
      skills: [
        {
          description: "A energia vem em pacotes mínimos, não em qualquer quantidade.",
          name: "Explicar que a energia vem em pacotes",
        },
        {
          description: "A luz se comporta como onda e como partícula.",
          name: "Reconhecer a dualidade onda-partícula",
        },
      ],
      variant: "whatIf",
    },
  },
  {
    expectations: `A nursing case in Brazilian Portuguese on a hospital ward: checking a weight-based dose before giving it, with a physician, a pharmacist or a senior nurse and an AI assistant. The strong path double-checks the calculation and the prescription, and raises a doubt with the prescriber clearly and respectfully. Doses and units must be correct and consistent (mg/kg, mL). Must model safe practice: never give a dose that looks wrong without checking. Not counting the AI assistant, the first colleague's role and every word about them is feminine and the second's masculine where Portuguese marks it ("a farmacêutica", "o médico plantonista"), since the app names them a woman and then a man.`,
    id: "pt-nursing-dose-work",
    userInput: {
      chapterDescription: "Calcular e conferir doses de medicamentos por peso com segurança.",
      chapterTitle: "Cálculo de doses",
      courseTitle: "Farmacologia para enfermagem",
      language: "pt",
      level: "intermediate",
      skills: [
        {
          description: "Calcular a dose a partir do peso do paciente.",
          name: "Calcular dose por peso",
        },
        {
          description: "Conferir prescrição, unidade e via antes de administrar.",
          name: "Conferir a prescrição",
        },
        {
          description: "Levar uma dúvida ao médico de forma clara e segura.",
          name: "Comunicar uma dúvida ao médico",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A first-weeks case for someone new to data analysis (a career changer in a junior analyst role): a messy spreadsheet (duplicates, blanks, inconsistent dates or names) and a manager who needs numbers soon. The strong path inspects and cleans before summarizing, uses the AI assistant to speed up the work but checks what it produced, and tells the manager about the limits of the data. Numbers must add up after cleaning.`,
    id: "en-career-change-data-cleaning",
    userInput: {
      chapterDescription: "Find and fix the problems in real-world data before analyzing it.",
      chapterTitle: "Cleaning messy data",
      courseTitle: "Data analysis",
      language: "en",
      level: "beginner",
      skills: [
        {
          description: "Spot duplicates, blanks and inconsistent entries.",
          name: "Find problems in a data set",
        },
        {
          description: "Fix or remove bad rows and say what you changed.",
          name: "Clean data safely",
        },
        {
          description: "Check an AI assistant's output before using it.",
          name: "Check what AI produced",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `The same statistics chapter as "en-ab-test-work", but for a learner who works in nursing: the case happens on a hospital ward, such as a nurse manager asked whether a new fall-prevention or hand-hygiene routine really lowered a rate between two units or two months, with colleagues a nursing ward works with (a charge nurse, an infection-control nurse, a unit manager) and an AI assistant. It must still train telling a real difference from chance, sample size and explaining the result, without marketing or A/B tests, and nursing knowledge must not decide the right choices. Numbers must be realistic and consistent (a small gap on few patients isn't called significant). General to the field: a fictional hospital, no real names, no personal details, and no path ends with harm to a patient.`,
    id: "en-statistics-field-nursing",
    userInput: {
      chapterDescription: "Tell a real difference from chance in experiments like A/B tests.",
      chapterTitle: "Hypothesis testing",
      courseTitle: "Statistics",
      field: "nursing",
      language: "en",
      level: "beginner",
      skills: [
        {
          description: "Decide whether a gap between two groups could be chance.",
          name: "Tell a real difference from chance",
        },
        {
          description: "Know how many observations a comparison needs.",
          name: "Choose a sample size",
        },
        {
          description: "Explain a test result to people who aren't data people.",
          name: "Explain a test result",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A work case in Brazilian Portuguese for a learner who works in retail: a store (a fictional name) deciding a promotion or a price change, where successive percentages and the margin decide what's right (for example "aumentar 20% e dar 20% de desconto" doesn't return to the original price, and a discount on the sale price eats the margin faster than it seems). Colleagues a store works with (the store manager, the buyer, the finance person) and an AI assistant that checks calculations when asked. Every number in reais is right and consistent across panels, messages and endings, written the Brazilian way (R$ 1.234,56). General to the field, with no real company.`,
    id: "pt-porcentagem-field-retail",
    userInput: {
      chapterDescription: "Aumentos, descontos e margens aplicados em sequência no comércio.",
      chapterTitle: "Porcentagem no dia a dia",
      courseTitle: "Matemática financeira",
      field: "retail",
      language: "pt",
      level: "beginner",
      skills: [
        {
          description:
            "Calcular o efeito de aumentos e descontos percentuais aplicados um após o outro.",
          name: "Aumentos e descontos sucessivos",
        },
        {
          description: "Calcular a margem de lucro sobre o preço de venda.",
          name: "Calcular a margem",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A work case for a learner who works in research: reading values off plots of detector measurements (points, a curve, axis ticks, a truncated axis). The decisions that need a plot show one from the plan's \`visuals\`, drawn by the app: a \`plot\` for numbers on both axes (counts against voltage or time), a \`chart\` with \`axisStart\` for a cropped axis. Every path reaches a decision that shows a plot. A value the text states from a plot matches its data, the text names points by label and series by name (never "the third point"), and every value the learner must read sits on a round value or a label, never finer than the ticks. No panel repeats a plot's data, and no metric or message draws a chart in text. General to the field, with no real lab.`,
    id: "en-plot-reading-field-research",
    userInput: {
      chapterDescription:
        "Read values from plots of detector measurements while accounting for the ways real experimental plots are displayed.",
      chapterTitle: "Reading quantum experiment plots",
      courseTitle: "Quantum physics from scratch",
      field: "research",
      language: "en",
      level: "beginner",
      skills: [
        { description: null, name: "Read values from an experimental plot" },
        { description: null, name: "Estimate values between axis ticks" },
        { description: null, name: "Read values from plotted data points" },
        { description: null, name: "Estimate values from a plotted curve" },
        { description: null, name: "Read values on a truncated axis" },
        { description: null, name: "Interpret axis intervals" },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A work case for a beginner analyst who must interpret a scatterplot (for example ad spend against sales across stores, or study hours against scores), where a colleague wants to act on the pattern. The case shows a \`plot\` with \`mark\` \`points\` from \`visuals\` at the decision that needs it, and every path reaches a decision that shows it. The strong path reads the direction and strength of the pattern, notices an outlier by its label, and doesn't treat correlation as proof of cause. Text and plot agree: every value or count the text states from the plot (how many points above a line, a point's values) matches the data and is a fact whose derivation names the plot. Points are named by label, never by position. No panel repeats the plot's data.`,
    id: "en-scatterplot-work",
    userInput: {
      chapterDescription: "Read relationships between two numeric variables from scatterplots.",
      chapterTitle: "Correlation",
      courseTitle: "Statistics",
      language: "en",
      level: "beginner",
      skills: [
        {
          description: "Describe the direction, form and strength of a pattern and spot outliers.",
          name: "Interpret scatterplots",
        },
        {
          description:
            "Know that two things moving together doesn't show that one causes the other.",
          name: "Tell correlation from causation",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `Um caso de trabalho em português do Brasil sobre ler um gráfico posição-tempo (por exemplo, um técnico de trânsito, um treinador ou um engenheiro de testes olhando a posição de um veículo medida em instantes irregulares). O caso mostra um \`plot\` de \`visuals\` com tempo no eixo x e posição no eixo y, linha pelos pontos medidos com espaçamento proporcional, na decisão que precisa dele, e todo caminho passa por uma decisão que o mostra. O caminho forte lê a inclinação como velocidade e distingue posição de distância percorrida. Toda velocidade ou distância dita no texto bate com os dados do gráfico e é um fato com \`derivation\` que cita o gráfico; pontos são nomeados pelo rótulo ou pelo instante, nunca pela posição na tela. Nenhum painel repete os dados do gráfico.`,
    id: "pt-position-time-graph-work",
    userInput: {
      chapterDescription: "Ler posição, deslocamento e velocidade em gráficos posição-tempo.",
      chapterTitle: "Gráficos do movimento",
      courseTitle: "Física",
      language: "pt",
      level: "beginner",
      skills: [
        {
          description: "Ler a posição de um objeto em cada instante num gráfico posição-tempo.",
          name: "Ler um gráfico posição-tempo",
        },
        {
          description: "Calcular a velocidade a partir da inclinação entre dois pontos.",
          name: "Calcular velocidade pela inclinação",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A work case in manufacturing quality: reading a control chart of a process measurement (for example fill weight or a part's diameter by sample number) to decide whether to stop the line. The case shows a \`plot\` from \`visuals\` with a line through the samples and horizontal \`references\` for the center line and the control limits, at the decision that needs it, and every path reaches a decision that shows it. The strong path tells a point outside the limits or a run on one side (special cause) from ordinary variation, and doesn't adjust the process for common-cause noise. Every count or reading the text states (how many samples above the upper limit, which sample) matches the data, names samples by label, and is readable at the ticks. No panel repeats the chart's data.`,
    id: "en-control-chart-field-manufacturing",
    userInput: {
      chapterDescription:
        "Use control charts to tell special-cause variation from common-cause variation.",
      chapterTitle: "Statistical process control",
      courseTitle: "Quality management",
      field: "manufacturing",
      language: "en",
      level: "intermediate",
      skills: [
        {
          description: "Read a control chart's center line, limits and the samples against them.",
          name: "Read a control chart",
        },
        {
          description:
            "Decide when variation calls for action and when to leave the process alone.",
          name: "Tell special-cause from common-cause variation",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A work case on negotiating a supplier contract, where no skill is about reading data: \`visuals\` is empty and no decision shows a chart. The strong path anchors with a researched first offer and explores the other side's interests instead of splitting the difference at once. Numbers (prices, volumes, deadlines) are consistent across panels, replies and endings.`,
    id: "en-negotiation-no-chart-work",
    userInput: {
      chapterDescription:
        "Prepare and run a negotiation around interests and a strong first offer.",
      chapterTitle: "Negotiation basics",
      courseTitle: "Business communication",
      language: "en",
      level: "beginner",
      skills: [
        {
          description:
            "Open with a first offer backed by research, so the talk starts near your goal.",
          name: "Anchor a first offer",
        },
        {
          description: "Ask about what the other side needs behind its position.",
          name: "Find the other side's interests",
        },
      ],
      variant: "work",
    },
  },
];
