import { type OptionalCountry, type TestCase } from "@/lib/types";
import { type GenerateExampleLinesParams } from "@zoonk/ai/tasks/variants/example-lines";

type ExampleLinesInput = Omit<
  OptionalCountry<GenerateExampleLinesParams>,
  "analytics" | "learnerHomeCountry" | "model" | "reasoning" | "useFallback"
> & { learnerHomeCountry?: string | null };

const SHARED_EXPECTATIONS = `
  - The output is \`lines\`: one entry per screen in screen order (the first entry is screen 1), each one sentence or null when nothing the learner shared fits
  - Don't evaluate JSON formatting
`;

export const TEST_CASES: TestCase<never, ExampleLinesInput>[] = [
  {
    expectations:
      "Write one non-null sentence using at least one supplied fact naturally. Connect a concrete situation from software work, journalism, soccer, news or a named fictional show to the screen's multiplication rule. Use correct arithmetic. Do not invent biographical details.",
    id: "en-founder-first-lesson",
    userInput: {
      facts: [
        "Watches sci-fi and anime, especially Star Trek, Fringe and Dragon Ball",
        "Plays soccer",
        "Reads news and politics",
        "Works as: software engineer",
        "Studied journalism",
      ],
      goal: "Understand mathematics from the beginning",
      language: "en",
      screens: [
        {
          idea: "Several equal-sized groups in the learner's work or interests, counted by multiplication.",
          text: "Multiplication counts equal groups: 4 groups of 3 objects contain 12 objects.",
        },
      ],
    },
  },
  {
    expectations:
      "The learner never said they buy software, so null is acceptable. A line, if written, is a concrete discount on software for their work, with correct numbers and stated as an example, in literal language without idioms, metaphors or figures of speech.",
    id: "en-plain-words-example",
    userInput: {
      facts: ["Works as: software engineer"],
      goal: null,
      language: "en",
      plainWords: true,
      screens: [
        {
          idea: "A discount on software used for work.",
          text: "A 25% discount removes a quarter of the original price.",
        },
      ],
    },
  },

  {
    expectations:
      "The learner pays for their own software tools, so the line MUST be non-null: a concrete discount on a tool they pay for, with correct numbers stated as an example, in literal language without idioms, metaphors or figures of speech.",
    id: "en-plain-words-pays-for-tools",
    userInput: {
      facts: ["Works as a freelance software developer", "Pays for their own coding tools"],
      goal: null,
      language: "en",
      plainWords: true,
      screens: [
        {
          idea: "A discount on something the learner pays for.",
          text: "A 25% discount removes a quarter of the original price.",
        },
      ],
    },
  },

  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner shares the rent with two friends: a line splitting a rent three ways fits, with correct math
      - The learner never said where they live, so the line MUST NOT name a city, neighborhood or region, and MUST NOT state an amount as the rent they really pay: an amount is a clearly hypothetical example ("se o aluguel fosse R$ 1.200…") in the lesson's money, written the Brazilian way
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-rent-split-no-city",
    userInput: {
      facts: ["Faz faculdade à noite", "Divide o aluguel com duas amigas"],
      goal: "Organizar as finanças pessoais",
      language: "pt",
      screens: [
        {
          idea: "Uma conta dividida em partes iguais.",
          text: "Dividir uma conta em partes iguais é dividir o total pelo número de pessoas. Uma conta de R$ 90 entre 3 pessoas dá R$ 30 para cada uma.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner lives in Portugal (HOME_COUNTRY) and shares the rent with two friends: a line splitting their rent three ways fits, in euros written as Portugal writes them (900 €, 300 €), with correct math
      - MUST NOT use reais or R$ for the learner's own rent, even though the lesson is set in Brazil
      - The learner never named a city, so the line MUST NOT name one (not even Lisboa)
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-rent-split-lives-in-portugal",
    userInput: {
      facts: ["Faz faculdade à noite", "Divide o aluguel com duas amigas"],
      goal: "Organizar as finanças pessoais",
      language: "pt",
      learnerHomeCountry: "PT",
      screens: [
        {
          idea: "Uma conta dividida em partes iguais.",
          text: "Dividir uma conta em partes iguais é dividir o total pelo número de pessoas. Uma conta de R$ 90 entre 3 pessoas dá R$ 30 para cada uma.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The learner is saving for a car: a line with a percent of a clearly hypothetical saving ("if you put aside $2,500…"), in dollars written the US way, with correct math, fits
      - The learner never said where they live, so the line MUST NOT name a city or state, and MUST NOT state an amount as what they really save
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-car-savings-no-city",
    userInput: {
      facts: ["Works night shifts as a nurse", "Saving for a car"],
      goal: null,
      language: "en",
      screens: [
        {
          idea: "A percent of an amount the learner saves or spends.",
          text: "A percent is a number out of 100. 20% of $500 is 20 out of every 100 dollars: $100.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner works at a pharmacy: a line about a discount on something sold at a pharmacy fits, with the discount computed on the original price
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-pharmacy-discount",
    userInput: {
      facts: ["Trabalha numa farmácia em Recife", "Gosta de exemplos com números"],
      goal: "Revisar matemática básica",
      language: "pt",
      screens: [
        {
          idea: "Um desconto em algo que a pessoa compra ou vende.",
          text: "Um desconto de 25% tira um quarto do preço original. Num produto de R$ 80, isso é R$ 20 a menos: você paga R$ 60.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The learner bikes to work in Toronto: a percent change on something from their commute or city fits (a transit fare, a bike part), with correct numbers
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-toronto-percent-change",
    userInput: {
      facts: ["Lives in Toronto", "Bikes to work every day"],
      goal: null,
      language: "en",
      screens: [
        {
          idea: "A price the learner pays that went up or down.",
          text: "Percent change compares a change with the starting value. A ticket going from $80 to $100 changed by $20, which is 25% of $80.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Nothing the learner shared (studying at night, a driving test) fits photosynthesis naturally, so the right answer is null
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-no-fit-null",
    userInput: {
      facts: ["Prefers to study at night"],
      goal: "Pass the driving test",
      language: "en",
      screens: [
        {
          idea: "A plant the learner sees every day.",
          text: "Leaves use sunlight to turn water and carbon dioxide into sugar. The oxygen we breathe is what's left over.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner is a nurse: a dose or drip calculation fits the rule of three, and the numbers must be right (more medicine per dose in the same proportion)
      - It must not give medical advice beyond the arithmetic
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-nurse-rule-of-three",
    userInput: {
      facts: ["É enfermeira num hospital público"],
      goal: "Passar no concurso da prefeitura",
      language: "pt",
      screens: [
        {
          idea: "Uma proporção direta no trabalho da pessoa.",
          text: "Se 2 kg de farinha rendem 30 pães, 4 kg rendem 60: as duas quantidades crescem juntas, na mesma proporção. Isso é uma proporção direta.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Both screens teach an everyday reading skill with their own everyday examples (a message about a theater's entry time, a shop sign). Being a frontend engineer who speaks some Italian adds nothing to them, so both lines are null
      - The concurso is not a moment of the learner's life: a line about preparing for it, its notice or its questions ("Ao se preparar para o concurso…") is filler and scores at most 6
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-everyday-reading-lesson-null",
    userInput: {
      facts: [
        "É engenheiro de software, principalmente de frontend",
        "Já fala um pouco de italiano",
      ],
      goal: "Passar no concurso da Câmara dos Deputados",
      language: "pt",
      screens: [
        {
          idea: "Uma mensagem que confirma o horário de entrada em um evento.",
          text: "Igor recebe a mensagem: “A entrada no teatro será às 15h30. O ensaio começa às 16h.” Para conferir “É possível entrar às 15h30”, ele aponta a frase sobre a entrada. Esse trecho funciona como um comprovante da resposta: é uma **evidência textual**.",
        },
        {
          idea: "Uma placa com o horário de funcionamento de um lugar.",
          text: "Na porta da loja, a placa diz: “Fechado para almoço das 12h às 13h.” Quem chega às 12h30 encontra a loja fechada. Para conferir, Igor aponta o horário escrito na placa: a resposta está no próprio texto.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Nothing the learner shared (frontend work, some Italian) is a real moment for Ohm's law, so the right answer is null
      - Studying for the ENEM or solving one of its questions is not a moment of the learner's life: a line like "Ao estudar para o ENEM, se uma questão trouxer uma fonte de 12 V…" is filler and scores at most 6
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ohm-no-exam-framing",
    userInput: {
      facts: [
        "É engenheiro de software, principalmente de frontend",
        "Já fala um pouco de italiano",
      ],
      goal: "ENEM 2026",
      language: "pt",
      screens: [
        {
          idea: "A corrente em um resistor ligado a uma fonte de tensão.",
          text: String.raw`Se a resistência de um componente permanece constante, você pode calcular a corrente pela **lei de Ohm**: $V = R \times I$. Aqui, $V$ é a tensão, $R$ é a resistência e $I$ é a corrente. Para achar a corrente, divida a tensão pela resistência: $I = V \div R$.`,
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner already read a line that set the previous idea in a software company (EARLIER_LINES). Their only other fact (some Italian) doesn't fit, so the right answer is null
      - A line set in a software or technology company again, or starting like the earlier line, repeats the same moment and scores at most 6
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-stocks-no-repeat",
    userInput: {
      earlierLines: [
        "Na área de software em que você atua, uma empresa pode vender ações para levantar dinheiro e comprar equipamentos que ajudem a crescer.",
      ],
      facts: [
        "É engenheiro de software, principalmente de frontend",
        "Já fala um pouco de italiano",
      ],
      goal: "Entender como funciona a bolsa de valores",
      language: "pt",
      screens: [
        {
          idea: "A escolha de uma empresa entre parcelas fixas e novos donos para financiar uma expansão.",
          text: "Se a fábrica pegar um empréstimo, terá de pagar mesmo que venda menos bicicletas. Vender ações novas não cria essa obrigação. Em troca, ela passa a ter mais donos. Eles podem participar do **lucro**, o dinheiro que sobra depois dos custos, mas esse lucro não é garantido.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Two different examples are warranted: the learner works at a pharmacy and is paying a motorcycle in 12 installments. The first line applies the discount to something sold or bought at the pharmacy, and the second applies installment interest to the motorcycle, each with correct math and money written the Brazilian way
      - A null on either screen scores at most 7 here, and two lines set in the same moment (both at the pharmacy, or both about the motorcycle) score at most 6
      - The learner never said where they live, so no line names a city
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-two-moments-discount-installments",
    userInput: {
      facts: ["Trabalha numa farmácia", "Está pagando uma moto em 12 parcelas"],
      goal: "Revisar matemática financeira",
      language: "pt",
      screens: [
        {
          idea: "Um desconto em algo que a pessoa compra ou vende.",
          text: "Um desconto de 25% tira um quarto do preço original. Num produto de R$ 80, isso é R$ 20 a menos: você paga R$ 60.",
        },
        {
          idea: "Os juros de uma compra parcelada que a pessoa está pagando.",
          text: "Parcelar com juros custa mais que pagar à vista. Dez parcelas de R$ 110 por algo que custa R$ 1.000 somam R$ 1.100: R$ 100 são **juros**, o preço de pagar aos poucos.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The lines that are present each tell a different moment: the supermarket where she shops can appear in one line only, and her index fund in one line only. A second line in the same place or with the same money scores at most 6
      - The index-fund screen fits her R$ 200 a month in a fund that follows the Ibovespa, with correct math (an example total, if any, is said to be an example)
      - She works at a public hospital, but a line that only names the hospital without the idea happening there ("No hospital onde você trabalha, uma empresa…") is forced and scores at most 6
      - A null on a screen where every fitting moment was already used is right
      - No line recommends buying, selling or holding anything or promises returns
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-stocks-lesson-varied",
    userInput: {
      facts: [
        "É enfermeira num hospital público",
        "Investe R$ 200 por mês num fundo que segue o Ibovespa",
        "Faz as compras do mês sempre no mesmo supermercado",
      ],
      goal: "Entender como funciona a bolsa de valores",
      language: "pt",
      screens: [
        {
          idea: "Uma empresa que a pessoa conhece e da qual poderia ter uma pequena fatia.",
          text: "Uma **ação** é um pedaço pequeno de uma empresa. Quem compra uma ação vira sócio: dono de uma fatia, mesmo que minúscula, do negócio.",
        },
        {
          idea: "Dinheiro que a pessoa já tem investido, subindo ou caindo com o índice.",
          text: "Um **fundo de índice** compra as ações das empresas de um índice, como o Ibovespa. Se o índice sobe 2% num dia, o fundo sobe perto de 2% também; se cai, ele cai junto.",
        },
        {
          idea: "Uma fatia do lucro de uma empresa chegando a quem tem ações dela.",
          text: "Os **dividendos** são a parte do lucro que a empresa divide entre os sócios. Quem tem mais ações recebe mais: com 100 ações e R$ 0,50 por ação, você recebe R$ 50.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The learner's only fact is their barista job, which fits both percent ideas. Two lines set at the café repeat the same job and score at most 6: exactly one line uses the café (a tip or a menu price), with correct math in dollars written the US way, and the other line is null
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-one-fact-two-screens",
    userInput: {
      facts: ["Works as a barista"],
      goal: null,
      language: "en",
      screens: [
        {
          idea: "A percent of an amount the learner handles at work.",
          text: "A percent is a part out of 100. A 15% tip on a $20 bill is 15 out of every 100 dollars: $3.",
        },
        {
          idea: "A price the learner sees go up.",
          text: "Percent change compares a change with the starting value. A price going from $4 to $5 went up by $1, which is 25% of $4.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner's facts are about their routine: two buses to work every morning. A line about a bus fare going up, as a percent change on a clearly hypothetical fare in reais written the Brazilian way ("se a passagem fosse de R$ 4,40 para R$ 5,00"), with correct math, fits; the learner never said what they pay
      - The learner never said where they live, so the line MUST NOT name a city
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-routine-commute-fare",
    userInput: {
      facts: ["Pega dois ônibus para ir ao trabalho toda manhã", "Estuda depois do jantar"],
      goal: "Revisar matemática básica",
      language: "pt",
      screens: [
        {
          idea: "Um preço do dia a dia da pessoa que sobe.",
          text: "A variação percentual compara a mudança com o valor inicial. Um preço que vai de R$ 4,00 para R$ 5,00 subiu R$ 1,00, que é 25% de R$ 4,00.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The learner is saving for a house down payment within five years: a line where that saving earns compound interest, on a clearly hypothetical amount in dollars written the US way ("if you saved $20,000…"), with correct math, fits
      - "Understands faster with numbers" is how they learn, not a moment of their life: it may shape the line's numbers but is never its situation
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-goal-fact-down-payment",
    userInput: {
      facts: [
        "Is saving for a house down payment within five years",
        "Understands faster with numbers",
      ],
      goal: "Understand personal finance",
      language: "en",
      screens: [
        {
          idea: "Money the learner saves earning interest on its interest.",
          text: "Compound interest pays interest on the interest already earned. $1,000 at 5% a year becomes $1,050 after one year and $1,102.50 after two.",
        },
      ],
    },
  },
  {
    expectations: `
      - The learner only shared how they learn (worked examples, short explanations): no moment of their life fits, so the line MUST be null. A sentence about how they study or learn scores at most 4
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-learning-facts-null",
    userInput: {
      facts: [
        "Does better with a worked example before trying alone",
        "Prefers short explanations",
      ],
      goal: null,
      language: "en",
      screens: [
        {
          idea: "A discount on something the learner buys.",
          text: "A 20% discount takes a fifth off the price. On a $50 item, that's $10 off: you pay $40.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The lesson is about code and the learner writes code for a living, so a line set in their own software work (an app, API or service they build or maintain) only says the screen again: it scores at most 4, even when it's correct. EARLIER_LINES already did exactly that, and the line MUST NOT continue it
      - A good line shows the same mechanism in another part of their life the facts name (cooking dinner, a Formula 1 race), in everyday words, and maps it exactly: only the waiting task stops until its result arrives, while everything else goes on. A parallel where everything stops, or where nothing waits, is wrong. Null is acceptable; a forced parallel is not
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-developer-coding-lesson-not-work",
    userInput: {
      earlierLines: [
        "When you build a search page in a web app at work, you can focus the results heading without adding an extra Tab stop.",
        "When you show comments in a web app at work, textContent displays outside text without running it.",
      ],
      facts: [
        "Has built web applications since 2012",
        "Leads a small engineering team",
        "Knows cloud, APIs and software architecture well",
        "Follows every Formula 1 race",
        "Cooks dinner for the family on weekdays",
      ],
      goal: "Pass a public-sector IT exam",
      language: "en",
      screens: [
        {
          idea: "A list that loads in a web app the learner maintains at work.",
          text: "Inside an async function, `await` pauses only that function until the Promise brings its result. In `const data = await load(); show(data);`, `show` waits for the data, but code outside keeps running.",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The lesson is about Java and the learner has worked in software for years, so a line set in their own software work (a service, system or project they maintain) only says the screen again: it scores at most 4, even when it's correct
      - A good line shows the same problem in another part of their life the facts name (a Formula 1 race, a running group), in everyday words, and maps it exactly: one side changes a value and the other keeps acting on the old one until the change is made visible to it. A line that only says an updated signal becomes visible, without someone still acting on the old one, misses the screen's point and scores at most 6 for accuracy. Null is acceptable; a forced parallel is not
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-developer-java-volatile-not-work",
    userInput: {
      facts: [
        "Trabalha com software desde 2010, principalmente aplicações web",
        "Acompanha Fórmula 1",
        "Corre com um grupo aos domingos",
        "Estuda italiano",
      ],
      goal: "Passar num concurso de desenvolvimento de sistemas",
      language: "pt",
      screens: [
        {
          idea: "Um sinal de cancelamento de uma tarefa em segundo plano, num serviço Java que a pessoa mantém no trabalho.",
          text: "Sem sincronização, a thread do laço `while (!parar) {}` pode seguir usando um valor antigo de `parar`. Com `volatile boolean parar = false`, cada escrita no campo fica visível às leituras de outras threads. Esse modificador se chama **volatile**.",
        },
      ],
    },
  },
  {
    expectations: `
      - The lesson is about web code and the learner only shared facts about their own work in that field, so every line MUST be null: a line set in their software or web work only says the screen again and scores at most 4
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-developer-only-work-facts-null",
    userInput: {
      facts: ["Works as a frontend developer", "Maintains a React design system at work"],
      goal: null,
      language: "en",
      screens: [
        {
          idea: "A link or Submit button in a web system the learner uses at work.",
          text: "Clicking a link makes the browser open another address on its own: that's a **default action**. Calling `e.preventDefault()` in the listener cancels that navigation, but the click still bubbles up through the elements that contain the link.",
        },
        {
          idea: "A comment box in a web system the learner maintains at work.",
          text: 'With `innerHTML`, an image tag with a broken address and `onerror="steal()"` runs `steal()` when it fails to load. With `textContent`, the same text shows up as plain text.',
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The learner is a nurse learning to code, so their ward is a setting outside the lesson's subject: a line where the same step repeats for each patient, chart or dose on their round fits, and it maps the loop exactly (one action, once per item, until the list ends). A line about writing code at work is invented
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-nurse-coding-lesson-work-fits",
    userInput: {
      facts: ["Works as a nurse on a hospital ward", "Learning Python to automate reports"],
      goal: "Write small Python scripts",
      language: "en",
      screens: [
        {
          idea: "The same step done once for each item in a list.",
          text: "A `for` loop runs the same lines once for each item in a list. `for name in names: print(name)` prints every name, one per line, and stops after the last.",
        },
      ],
    },
  },
];
