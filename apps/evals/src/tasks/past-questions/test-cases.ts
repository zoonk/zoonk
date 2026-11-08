import { type TestCase } from "@/lib/types";
import { type ExtractPastQuestionsParams } from "@zoonk/ai/tasks/items/past-questions";
import papers from "./papers.json";

type PastQuestionsInput = Omit<ExtractPastQuestionsParams, "model" | "useFallback" | "reasoning">;

const ENEM_STYLE_PAPER = `ENEM 2022 – 2º DIA – CADERNO AZUL (trecho)
QUESTÃO 141
Uma loja de eletrodomésticos reajustou o preço de uma geladeira em 10% em janeiro. Em março,
fez uma promoção e deu desconto de 10% sobre o preço de fevereiro.
Disponível em: www.economia.exemplo.br. Acesso em: 12 abr. 2022 (adaptado).
Em relação ao preço antes do reajuste, o preço na promoção ficou
A igual.
B 1% menor.
C 1% maior.
D 10% menor.
E 20% menor.
QUESTÃO 142
Observe o gráfico, que mostra o consumo mensal de energia de uma residência ao longo de 2021.
Em qual mês o consumo foi maior?
A Janeiro.
B Março.
C Julho.
D Outubro.
E Dezembro.
QUESTÃO 143
Um terreno retangular mede 12 m por 25 m. Qual é a área do terreno?
A 37 m².
B 74 m².
C 150 m².
D 300 m².
E 600 m².
QUESTÃO 144
Um produto que custava R$ 250,00 passou a custar R$ 300,00. O aumento percentual no
preço foi de
A 5%.
B 16,7%.
C 20%.
D 50%.
E 83,3%.
GABARITO – 2º DIA – CADERNO AZUL
141 B 142 C 143 D 144 C`;

const CEBRASPE_STYLE_PAPER = `CEBRASPE – TRT 8ª REGIÃO – 2022 – TÉCNICO JUDICIÁRIO (trecho)
Texto para os itens de 41 a 44
Um servidor público, ao analisar pedido de licença de um colega, decidiu favorecê-lo por
serem amigos de longa data, concedendo o benefício sem observar os requisitos previstos em lei.
Com base na situação hipotética acima, julgue os itens a seguir, acerca dos princípios da
administração pública.
41 A conduta do servidor violou o princípio da impessoalidade.
42 O princípio da legalidade permite ao servidor fazer tudo o que a lei não proíbe.
43 A publicidade dos atos administrativos é requisito de eficácia desses atos.
44 O organograma apresentado na figura mostra que o setor de pessoal está subordinado à
diretoria-geral.
GABARITO PRELIMINAR: 41 C 42 E 43 C 44 C`;

const CLERICAL_PAPER = `STATE MERIT SYSTEM – CLERICAL EXAM – 2024 RELEASED ITEMS
Question 12
A clerk earns $18.50 per hour and works 36 hours in a week. How much does the clerk earn
that week before taxes?
(A) $54.50
(B) $666.00
(C) $684.50
(D) $740.00
Question 13
Use the table below to answer the question.
In which month were the most boxes of paper ordered?
(A) January
(B) February
(C) March
(D) April
Question 14
An office bought 3 boxes of pens at $4.25 each and 2 reams of paper at $6.80 each. What
was the total cost?
(A) $11.05
(B) $26.35
(C) $22.10
(D) $12.75
ANSWER KEY: 12-B, 13-C, 14-B`;

export const TEST_CASES: TestCase<unknown, PastQuestionsInput>[] = [
  {
    expectations: `Two questions in Brazilian Portuguese: 141 (successive percentages, key B, "1% menor") tagged with skill 1, and 144 (percent change, key C, 20%) tagged with skill 2. Question 142 needs a chart and 143 tests area, which isn't a listed skill, so both are left out. Question 141 keeps its credit line ("Disponível em: ... (adaptado).") in its support text. Citations name Enem 2022, the second day and the number.`,
    id: "pt-enem-style-percentages",
    userInput: {
      exam: "Enem",
      format: "multipleChoice",
      language: "pt",
      optionCount: 5,
      paper: { text: ENEM_STYLE_PAPER, title: "Enem 2022 – 2º dia – Caderno Azul" },
      skills: [
        {
          description:
            "Calcular o efeito de aumentos e descontos percentuais aplicados um após o outro.",
          name: "Aumentos e descontos percentuais sucessivos",
        },
        {
          description: "Calcular a variação percentual entre um valor inicial e um final.",
          name: "Variação percentual",
        },
      ],
    },
  },
  {
    expectations: `Three true-or-false items in Brazilian Portuguese, each with the shared support text as its context: 41 true (favoring a friend breaks impessoalidade), 42 false (legalidade means the administration may only do what the law allows; the trap swaps it for the private-law rule) and 43 true (publicity is a condition for the act to take effect). Item 44 depends on a figure the text doesn't carry, so it's left out. Check the legal accuracy of every reason. Citations name Cebraspe, the exam and the item number.`,
    id: "pt-cebraspe-style-principios",
    userInput: {
      exam: "Cebraspe, TRT 8ª Região, Técnico Judiciário",
      format: "trueFalse",
      language: "pt",
      paper: { text: CEBRASPE_STYLE_PAPER, title: "Cebraspe – TRT 8ª Região – 2022" },
      skills: [
        {
          description:
            "Aplicar os princípios da administração pública do art. 37 da Constituição a situações concretas.",
          name: "Princípios da administração pública (LIMPE)",
        },
      ],
    },
  },
  {
    expectations: `Two questions in US English: 12 (key B, $666.00, from 18.50 × 36) tagged with skill 1, and 14 (key B, $26.35, from 3 × 4.25 + 2 × 6.80) tagged with skill 2. Question 13 needs a table the text doesn't carry, so it's left out. Options are copied without their letters. Wrong options' misconceptions are real slips such as adding instead of multiplying or counting only one kind of item. Citations name the clerical exam, 2024 and the number.`,
    id: "en-clerical-exam-money",
    userInput: {
      exam: "State Merit System, Clerical Exam",
      format: "multipleChoice",
      language: "en",
      optionCount: 4,
      paper: {
        text: CLERICAL_PAPER,
        title: "State Merit System – Clerical Exam – 2024 released items",
      },
      skills: [
        {
          description:
            "Multiply amounts of money with decimals, such as an hourly wage by hours worked.",
          name: "Multiply decimals in money problems",
        },
        {
          description: "Find the total cost of several items bought in different quantities.",
          name: "Total cost of several items",
        },
      ],
    },
  },
  {
    // The whole second-day paper as the production parser reads Inep's PDF; Inep publishes the
    // answer key apart, so the paper carries none.
    expectations: `Up to ten questions in Brazilian Portuguese, only from Matemática (136 to 180) and only on the three listed skills, each tagged with the skill it tests. Every copied question's correct option matches Inep's official key: 136 B, 137 C, 138 C, 139 D, 140 E, 141 E, 142 A, 143 B, 144 C, 145 B, 146 E, 147 D, 148 C, 149 E, 150 A, 151 B, 152 B, 153 E, 154 B, 155 D, 156 A, 157 B, 158 D, 159 D, 160 A, 161 D, 162 D, 163 A, 165 E, 166 C, 167 A, 168 A, 169 D, 170 D, 171 C, 172 C, 173 B, 174 E, 175 B, 176 E, 177 A, 178 B, 179 C, 180 C. Question 164 was annulled and is never copied. A question whose answer depends on a figure, chart, graph or table the text doesn't carry in full is left out. Context, question and options are copied as the paper words them, credit lines included. The text reader glued many of the paper's words together ("Onúmeromínimodesalasquedeverãoserconstruídasé"): a copied question puts the spaces back, since learners read it as written. Citations name Enem 2023, the second day and the number.`,
    id: "pt-enem-2023-full-day-2",
    userInput: {
      count: 10,
      exam: "Enem",
      format: "multipleChoice",
      language: "pt",
      optionCount: 5,
      paper: { text: papers.enem2023Day2Blue, title: "Enem 2023 – 2º dia – Caderno 7 – Azul" },
      skills: [
        {
          description:
            "Calcular porcentagens, aumentos, descontos e juros em situações do dia a dia.",
          name: "Porcentagem e juros",
        },
        {
          description:
            "Calcular a probabilidade de um evento em situações com resultados igualmente prováveis.",
          name: "Probabilidade",
        },
        {
          description: "Calcular e interpretar média, mediana e moda de um conjunto de dados.",
          name: "Média, mediana e moda",
        },
      ],
    },
  },
  {
    // The whole paper as the production parser reads NYSED's PDF: it turns +, - and = into 1, 2
    // and 5, and drops radicals and figures. NYSED publishes the scoring key apart.
    expectations: `Questions in US English from Part I (the multiple-choice questions 1 to 24) only. The questions that read correctly and test a listed skill are 3 (skill 1, key: Dylan's 5% monthly growth), 4 (skill 2, key: Andrea's mean is higher but Joe's standard deviation is higher) and 7 (skill 3, key: 6), and each is copied with that key. Question 12 needs its box plots and is left out. Questions 14 and 16 lost their square roots in the text ("The sum of 3 and 5 is"), so copying them would make the key false: they are left out, and skill 4 gets no question. Questions whose expressions came out garbled (such as "2x2 1 3x 1 1") are left out. Options are copied without their numbers, matched to the right option even though the paper prints them in the order (1), (3), (2), (4). Citations name the Algebra I Regents, June 2025 and the number.`,
    id: "en-algebra-one-regents-june-2025-full",
    userInput: {
      count: 10,
      exam: "Regents Examination in Algebra I",
      format: "multipleChoice",
      language: "en",
      optionCount: 4,
      paper: {
        text: papers.algebraOneJune2025,
        title: "Regents Examination in Algebra I – June 2025",
      },
      skills: [
        {
          description:
            "Tell whether a situation grows by a constant amount or by a constant percent.",
          name: "Linear and exponential relationships",
        },
        {
          description:
            "Compare the center and spread of two data sets, such as their means and standard deviations.",
          name: "Compare data sets",
        },
        {
          description:
            "Find the average rate of change of a function over an interval from a table.",
          name: "Average rate of change",
        },
        {
          description:
            "Tell whether sums and products of rational and irrational numbers are rational.",
          name: "Rational and irrational numbers",
        },
      ],
    },
  },
];
