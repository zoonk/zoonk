import { type TestCase } from "@/lib/types";
import { type GenerateStepVariantParams } from "@zoonk/ai/tasks/variants/step-variant";

type StepVariantInput = Omit<
  GenerateStepVariantParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const SHARED_EXPECTATIONS = `
  - The output is the same kind of screen as the original, with every field the original fills
  - \`image\` stays null, and \`exampleLineIdea\`, \`visual\` and \`explore\` may stay null when the original has none
  - Don't evaluate JSON formatting
`;

export const TEST_CASES: TestCase<never, StepVariantInput>[] = [
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
            {
              math: String.raw`\frac{20}{80} = 0{,}25`,
              text: "Divida a variação pelo preço inicial.",
            },
            { math: String.raw`0{,}25 = 25\%`, text: "Escreva como porcentagem." },
          ],
          title: "De R$ 80 para R$ 100",
        },
        kind: "workedExample",
      },
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
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The same question (orders of 20, 45, 80 and 15; how many are over 30) asked through SQL: the four amounts in a table and a query such as \`SELECT COUNT(*) FROM orders WHERE amount > 30;\`, asking what it returns
      - Still exactly one right option (2) and a reason on every option, with the wrong options from real slips (such as counting every row, or counting the amounts under 30)
      - Real SQL that runs as written

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tool-sql-count-check",
    userInput: {
      key: "SQL",
      language: "en",
      lessonTitle: "Filtering rows",
      level: "beginner",
      screen: {
        content: {
          options: [
            { id: "two", isCorrect: true, reason: "Only 45 and 80 are over 30.", text: "2" },
            { id: "four", isCorrect: false, reason: "That counts every order.", text: "4" },
            { id: "one", isCorrect: false, reason: "45 is over 30 too.", text: "1" },
          ],
          question: "Four orders came in: $20, $45, $80 and $15. How many are over $30?",
        },
        kind: "check",
      },
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Shows rounding to the nearest ten in Python code, with 47 giving 50 and 43 giving 40
      - Every value it says Python returns is what Python really returns. Python's \`round(45, -1)\` gives 40, not 50, because it rounds a tie to the even ten: a version that uses \`round\` says so or leaves the tie out. Code that rounds half up, such as \`int(x / 10 + 0.5) * 10\`, keeps the original's "45 becomes 50" and is just as right
      - Still teaches the rule from the original: look at the ones digit

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tool-python-round-tie",
    userInput: {
      key: "Python",
      language: "en",
      lessonTitle: "Rounding to the nearest ten",
      level: "beginner",
      screen: {
        content: {
          text: "To round to the nearest ten, look at the ones digit. 47 becomes 50 and 43 becomes 40. A 5 rounds up, so 45 becomes 50.",
          title: "Look at the ones digit",
        },
        kind: "explanation",
      },
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The same worked example (15% off a R$ 200 jacket) done in a spreadsheet with a formula that works the same in Google Sheets and Excel, such as \`=200*(1-15%)\` or \`=A1*(1-B1)\`, and what the cell shows (170)
      - Keeps 2 to 8 short steps, each one move, and the result is still R$ 170
      - No menus or functions that exist in only one of the two

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-tool-spreadsheet-discount",
    userInput: {
      key: "Planilha (Google Sheets ou Excel)",
      language: "pt",
      lessonTitle: "Descontos",
      level: "beginner",
      screen: {
        content: {
          problem: "Uma jaqueta de R$ 200 está com 15% de desconto. Quanto ela custa?",
          result: "A jaqueta custa R$ 170.",
          steps: [
            { math: String.raw`200 \times 0{,}15 = 30`, text: "Calcule o desconto." },
            { math: "200 - 30 = 170", text: "Tire o desconto do preço." },
          ],
          title: "15% de R$ 200",
        },
        kind: "workedExample",
      },
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Never asks the learner to open Google Sheets, select cells, click a menu or make the chart
      - Shows what the column chart of the five monthly sales would look like and what it tells you (which month sold most), instead of the steps to make it
      - Doesn't say the learner is missing out

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-no-install-sheets-chart",
    userInput: {
      key: "no-install",
      language: "pt",
      lessonTitle: "Gráficos de colunas",
      level: "beginner",
      screen: {
        content: {
          text: "Abra o Google Planilhas e digite as vendas de janeiro a maio em A1:A5: 12, 18, 9, 22 e 15. Selecione A1:A5 e clique em Inserir > Gráfico. Escolha colunas e veja qual mês vendeu mais.",
          title: "Faça seu gráfico",
        },
        kind: "explanation",
      },
    },
  },
];
