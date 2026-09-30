import { type TestCase } from "@/lib/types";
import { type GenerateStepVariantParams } from "@zoonk/ai/tasks/v2/variants/step-variant";

type StepVariantInput = Omit<
  GenerateStepVariantParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const SHARED_EXPECTATIONS = `
  - The output is the same kind of screen as the original, with every field filled
  - Don't evaluate JSON formatting
`;

export const TEST_CASES: TestCase<never, StepVariantInput>[] = [
  {
    expectations: `
      - MUST be in US English
      - A clearly simpler version of the percent change explanation: easier words, a more everyday example, no formula or a formula explained word by word
      - Still says that the change is compared with the starting value, not the new one

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-percent-change-simpler",
    userInput: {
      key: "",
      language: "en",
      lessonTitle: "Percent change",
      level: "beginner",
      screen: {
        content: {
          text: "Percent change compares a change with the **starting value**. A ticket going from $80 to $100 changed by $20, and $20 is 25% of $80. So the price rose 25%, even though $20 is only 20% of the new $100.",
          title: "Compare with the start",
        },
        kind: "explanation",
      },
      variant: "simpler",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - A deeper version of the worked example: the same problem with the reasoning behind each step, such as why the starting value is the reference and how a decrease is written as a negative change
      - Every number stays correct: from $80 to $100 is +$20, and 20 ÷ 80 = 0.25 = 25%

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-percent-change-worked-deeper",
    userInput: {
      key: "",
      language: "en",
      lessonTitle: "Percent change",
      level: "beginner",
      screen: {
        content: {
          problem: "A concert ticket went from $80 to $100. By what percent did the price change?",
          result: "The price rose 25%.",
          steps: [
            { math: "100 - 80 = 20", text: "Find the change: new price minus old price." },
            { math: "\\frac{20}{80} = 0.25", text: "Divide the change by the starting price." },
            { math: "0.25 = 25\\%", text: "Write it as a percent." },
          ],
          title: "From $80 to $100",
        },
        kind: "workedExample",
      },
      variant: "deeper",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - A clearly simpler version: more everyday words and example, no new terms like "grandeza" left unexplained
      - Still says what stays fixed decides whether the relation is direct or inverse: same order, more people, less time; same team, bigger order, more time

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-regra-simpler",
    userInput: {
      key: "",
      language: "pt",
      lessonTitle: "Regra de três simples e composta",
      level: "intermediate",
      screen: {
        content: {
          text: "Você acabou de comparar duas mudanças separadas. Para o mesmo pedido, mais trabalhadores significam menos tempo: é uma relação **inversa**. Com a mesma equipe, mais etiquetas significam mais tempo: é uma relação **direta**. Diga sempre o que fica fixo.",
          title: "O que fica fixo?",
        },
        kind: "explanation",
      },
      variant: "simpler",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - A deeper version for a curious adult of why squeezing the electron costs energy: the more precisely its position is confined, the more its motion spreads (the uncertainty principle), so its kinetic energy rises
      - It may name the idea precisely, but no heavy formulas: the lesson is an overview, so one step deeper still reads as a story
      - Must not claim there is a literal spring or force pushing the electron out

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-eletron-deeper",
    userInput: {
      key: "",
      language: "pt",
      lessonTitle: "Por que o elétron não cai no núcleo",
      level: "overview",
      screen: {
        content: {
          text: "O núcleo atrai o elétron para perto. Mas concentrar sua nuvem num espaço minúsculo exige mais energia. Pense em tentar confinar algo que resiste a ficar espremido: apertar tem um custo. Isso é só uma comparação; não existe uma mola dentro do átomo.",
          title: "Apertar exige energia",
        },
        kind: "explanation",
      },
      variant: "deeper",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Shows the mean the way it's done in a spreadsheet: the AVERAGE function over a range, such as \`=AVERAGE(B2:B6)\`, which works the same in Google Sheets and Excel, and what it returns for these scores (85)
      - Still says the mean adds the values and divides by how many there are, with the same five scores
      - No menus or functions that exist in only one of the two

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tool-spreadsheet-mean",
    userInput: {
      key: "Spreadsheet (Google Sheets or Excel)",
      language: "en",
      lessonTitle: "The mean",
      level: "beginner",
      screen: {
        content: {
          text: "The **mean** is the typical value: add all the values and divide by how many there are. Quiz scores of 80, 90, 75, 95 and 85 add up to 425, and 425 ÷ 5 = 85.",
          title: "Add, then divide",
        },
        kind: "explanation",
      },
      variant: "tool",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The same worked example (a price going from R$ 80 to R$ 100) done in Python: the change divided by the starting value, such as \`(100 - 80) / 80 * 100\`, with what Python prints (25.0)
      - Keeps 2 to 8 short steps, each one move, and the result is still a 25% increase
      - Real Python syntax that runs as written

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-tool-python-percent-change",
    userInput: {
      key: "Python",
      language: "pt",
      lessonTitle: "Variação percentual",
      level: "beginner",
      screen: {
        content: {
          problem: "Um ingresso foi de R$ 80 para R$ 100. Qual foi a variação percentual?",
          result: "O preço subiu 25%.",
          steps: [
            { math: "100 - 80 = 20", text: "Calcule a variação: preço novo menos o antigo." },
            { math: "\\frac{20}{80} = 0{,}25", text: "Divida a variação pelo preço inicial." },
            { math: "0{,}25 = 25\\%", text: "Escreva como porcentagem." },
          ],
          title: "De R$ 80 para R$ 100",
        },
        kind: "workedExample",
      },
      variant: "tool",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Never asks the learner to open a terminal, install, download or run anything on their computer
      - Shows what would be typed (\`python3 --version\`) and exactly what it prints (such as \`Python 3.13.1\`), and what that tells you (Python is there, and which version)
      - Doesn't say the learner is missing out

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-no-install-terminal-version",
    userInput: {
      key: "no-install",
      language: "en",
      lessonTitle: "Check your Python version",
      level: "beginner",
      screen: {
        content: {
          text: "Open your terminal and type `python3 --version`, then press Enter. If Python is installed, you'll see its version, like `Python 3.13.1`. Try it now before moving on.",
          title: "Ask Python its version",
        },
        kind: "explanation",
      },
      variant: "tool",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The check no longer asks the learner to open Excel or type anything: it shows the cells (10, 20 and 30 in A1 to A3) and the formula \`=SOMA(A1:A3)\`, and asks what the cell would show
      - Still exactly one right option (60) and a reason on every option, with the wrong options from real slips (such as adding only two cells or reading the formula as text)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-no-install-excel-check",
    userInput: {
      key: "no-install",
      language: "pt",
      lessonTitle: "Somar uma coluna na planilha",
      level: "beginner",
      screen: {
        content: {
          options: [
            { id: "sixty", isCorrect: true, reason: "SOMA junta 10 + 20 + 30 = 60.", text: "60" },
            { id: "thirty", isCorrect: false, reason: "Somou só A1 e A2.", text: "30" },
            {
              id: "formula",
              isCorrect: false,
              reason: "Com o sinal de igual, a planilha calcula.",
              text: "=SOMA(A1:A3)",
            },
          ],
          question:
            "Abra o Excel, digite 10, 20 e 30 em A1, A2 e A3 e, em A4, digite =SOMA(A1:A3). O que aparece em A4?",
        },
        kind: "check",
      },
      variant: "tool",
    },
  },
];
