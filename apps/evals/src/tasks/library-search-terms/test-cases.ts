import { type TestCase } from "@/lib/types";
import { type SearchTermsParams } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { type LibraryIdentitySubject } from "@zoonk/ai/tasks/v2/identity/subject";
import { type LibrarySearchItem, type LibrarySearchTermsExpected } from "./scorer";

type LibrarySearchTermsTestCase = TestCase<LibrarySearchTermsExpected, SearchTermsParams>;

/** One requested item and its own library: the row to find first, then near misses. */
type SearchCaseItem = {
  library: [LibrarySearchItem, ...LibrarySearchItem[]];
  subject: LibraryIdentitySubject;
};

/** A case asking for every item in one call, each scored against its own library. */
function batchCase({
  id,
  items,
}: {
  id: string;
  items: SearchCaseItem[];
}): LibrarySearchTermsTestCase {
  return {
    expected: {
      items: items.map((item) => ({ library: item.library, targetId: item.library[0].id })),
    },
    id,
    userInput: { subjects: items.map((item) => item.subject) },
  };
}

/**
 * Each case holds the item a request should find, written in different words
 * than the request, and near misses on sibling topics. The item's text is what
 * the database searches: title, description, objectives or skill names. Single
 * cases ask for one item, as a course, source or image search does.
 */
function searchCase({
  id,
  library,
  subject,
}: {
  id: string;
  library: [LibrarySearchItem, ...LibrarySearchItem[]];
  subject: LibraryIdentitySubject;
}): LibrarySearchTermsTestCase {
  return batchCase({ id, items: [{ library, subject }] });
}

const SINGLE_TEST_CASES: LibrarySearchTermsTestCase[] = [
  searchCase({
    id: "en-lesson-discount",
    library: [
      {
        id: "target",
        text: "Percent off: sale prices. Work out what you pay when an item is 20% off. Find a price after a percentage reduction",
      },
      { id: "interest", text: "Simple interest on a loan. Calculate simple interest" },
      { id: "tax", text: "Sales tax. Add tax to a price at the register" },
      { id: "tips", text: "Tipping at restaurants. Work out a tip on a bill" },
    ],
    subject: {
      goal: "Handle money at my new retail job",
      item: {
        description: "Find the final price of an item on sale",
        level: "beginner",
        skills: ["Calculate a discounted price"],
        title: "Calculate a discount",
      },
      kind: "lesson",
      language: "en",
    },
  }),
  searchCase({
    id: "en-lesson-balance-equations",
    library: [
      {
        id: "target",
        text: "Stoichiometric coefficients. Make atoms match on both sides of a reaction. Adjust coefficients so reactants and products have the same atoms",
      },
      { id: "moles", text: "The mole. Convert grams to moles with molar mass" },
      { id: "bonds", text: "Ionic and covalent bonds. Tell how atoms share or give electrons" },
    ],
    subject: {
      item: {
        description: "Make both sides of a chemical equation have the same atoms",
        level: "beginner",
        skills: ["Balance a chemical equation using coefficients"],
        title: "Balance chemical equations",
      },
      kind: "lesson",
      language: "en",
    },
  }),
  searchCase({
    id: "en-skill-balance-sheet",
    library: [
      {
        id: "target",
        text: "Interpret a statement of financial position. Tell what a company owns, owes and what is left for owners",
      },
      { id: "income", text: "Read an income statement. Follow revenue down to net profit" },
      { id: "cash", text: "Read a cash flow statement. See where cash came from and went" },
    ],
    subject: {
      item: {
        description: "Understand what a company owns and owes",
        title: "Read a balance sheet",
      },
      kind: "skill",
      language: "en",
    },
  }),
  searchCase({
    id: "en-chapter-photosynthesis",
    library: [
      {
        id: "target",
        text: "How plants make food. Light-dependent reactions, the Calvin cycle and chlorophyll",
      },
      { id: "respiration", text: "Cellular respiration. How cells release energy from glucose" },
      { id: "cells", text: "Plant cells. Cell wall, vacuole and other parts of a plant cell" },
    ],
    subject: {
      item: {
        description: "How plants turn light into chemical energy",
        level: "beginner",
        objectives: ["Explain how plants make glucose from light"],
        title: "Photosynthesis",
      },
      kind: "chapter",
      language: "en",
    },
  }),
  searchCase({
    id: "en-source-ielts",
    library: [
      {
        id: "target",
        text: "IELTS Academic: what to expect on test day. British Council. https://takeielts.britishcouncil.org/academic",
      },
      { id: "toefl", text: "TOEFL iBT test content. ETS. https://www.ets.org/toefl" },
      { id: "cambridge", text: "C1 Advanced exam format. Cambridge English" },
    ],
    subject: {
      item: { publisher: "British Council", title: "IELTS Academic test format" },
      kind: "source",
      language: "en",
    },
  }),
  searchCase({
    id: "en-image-budget-chart",
    library: [
      { id: "target", text: "Circle graph of monthly spending split into rent, food and savings" },
      { id: "bar", text: "Bar graph comparing rainfall in four cities" },
      { id: "coins", text: "A jar of coins on a kitchen table" },
    ],
    subject: {
      item: { title: "A pie chart with three slices showing a household budget" },
      kind: "image",
      language: "en",
    },
  }),
  searchCase({
    id: "pt-lesson-rule-of-three",
    library: [
      {
        id: "target",
        text: "Grandezas diretamente proporcionais. Descubra um valor desconhecido quando duas grandezas crescem juntas. Montar uma proporção entre duas razões",
      },
      { id: "percent", text: "Porcentagem. Calcular uma parte de um total" },
      { id: "fractions", text: "Frações equivalentes. Simplificar frações" },
    ],
    subject: {
      item: {
        description: "Encontrar um valor a partir de três valores conhecidos",
        level: "beginner",
        skills: ["Resolver problemas de regra de três"],
        title: "Regra de três simples",
      },
      kind: "lesson",
      language: "pt",
    },
  }),
  searchCase({
    id: "pt-lesson-compound-interest",
    library: [
      {
        id: "target",
        text: "Montante com capitalização composta. Como o dinheiro cresce quando os juros rendem juros. Aplicar a fórmula M = C(1+i)^t",
      },
      {
        id: "simple",
        text: "Juros simples. Juros calculados só sobre o capital inicial. Calcular juros simples",
      },
      { id: "inflation", text: "Inflação e poder de compra. Entender o IPCA" },
    ],
    subject: {
      item: {
        description: "Calcular quanto um investimento rende ao longo do tempo",
        level: "beginner",
        skills: ["Calcular o montante de uma aplicação"],
        title: "Juros compostos",
      },
      kind: "lesson",
      language: "pt",
    },
  }),
  searchCase({
    id: "pt-skill-present-tense",
    library: [
      {
        id: "target",
        text: "Conjugação de verbos regulares no presente do indicativo. Eu falo, tu falas, ele fala",
      },
      { id: "past", text: "Pretérito perfeito dos verbos regulares. Eu falei, tu falaste" },
      {
        id: "plural",
        text: "Plural dos substantivos. Formar o plural de palavras terminadas em -ão",
      },
    ],
    subject: {
      item: {
        description: "Usar as formas certas dos verbos -ar, -er e -ir no presente",
        title: "Flexionar verbos -ar, -er, -ir",
      },
      kind: "skill",
      language: "pt",
    },
  }),
  searchCase({
    id: "pt-chapter-french-revolution",
    library: [
      {
        id: "target",
        text: "A queda da monarquia na França (1789-1799). Tomada da Bastilha, Terror e ascensão de Napoleão",
      },
      { id: "industrial", text: "Revolução Industrial. Máquinas a vapor e fábricas na Inglaterra" },
      { id: "american", text: "Independência dos Estados Unidos. As treze colônias e 1776" },
    ],
    subject: {
      item: {
        description: "Causas, fases e consequências da revolução de 1789",
        level: "intermediate",
        objectives: ["Explicar por que a monarquia francesa caiu"],
        title: "Revolução Francesa",
      },
      kind: "chapter",
      language: "pt",
    },
  }),
  searchCase({
    id: "pt-source-enem-notice",
    library: [
      {
        id: "target",
        text: "Exame Nacional do Ensino Médio 2026: edital. Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira",
      },
      { id: "encceja", text: "Edital Encceja 2026. Inep" },
      { id: "sisu", text: "Sisu 2026: cronograma de inscrições. Ministério da Educação" },
    ],
    subject: {
      item: { publisher: "Inep", title: "Edital ENEM 2026" },
      kind: "source",
      language: "pt",
    },
  }),
  searchCase({
    id: "pt-image-animal-cell",
    library: [
      { id: "target", text: "Diagrama de uma célula eucariótica mostrando organelas" },
      { id: "bacteria", text: "Bactéria em forma de bastonete com flagelo" },
      { id: "plant", text: "Folha verde ao sol com gotas de orvalho" },
    ],
    subject: {
      item: { title: "Célula animal com núcleo, mitocôndrias e membrana plasmática" },
      kind: "image",
      language: "pt",
    },
  }),
  searchCase({
    id: "pt-course-statistics",
    library: [
      {
        id: "target",
        text: "Probabilidade e estatística. Médias, variação, amostras e testes para analisar dados",
      },
      { id: "calculus", text: "Cálculo. Limites, derivadas e integrais" },
      { id: "finance", text: "Matemática financeira. Juros, descontos e investimentos" },
    ],
    subject: {
      goal: "Analisar dados no trabalho",
      item: { title: "Estatística" },
      kind: "course",
      language: "pt",
    },
  }),
];

/** The row to find first, worded differently than the request, then near misses on sibling topics. */
function libraryWith(target: string, ...nearMisses: string[]): SearchCaseItem["library"] {
  return [
    { id: "target", text: target },
    ...nearMisses.map((text, index) => ({ id: `near-${index + 1}`, text })),
  ];
}

function searchItem(
  subject: LibraryIdentitySubject,
  found: SearchCaseItem["library"],
): SearchCaseItem {
  return { library: found, subject };
}

type Context = { course: string; goal: string | null; language: string };

/** A lesson as a course outline asks for it: its course, level and the skills it teaches. */
function lesson(
  context: Context,
  { description, skills, title }: { description: string; skills: string[]; title: string },
): LibraryIdentitySubject {
  return {
    goal: context.goal,
    item: { courses: [context.course], description, level: "beginner", skills, title },
    kind: "lesson",
    language: context.language,
  };
}

function skill(
  context: Context,
  { description, title }: { description: string; title: string },
): LibraryIdentitySubject {
  return {
    goal: context.goal,
    item: { description, title },
    kind: "skill",
    language: context.language,
  };
}

const inss = {
  course: "Direito Previdenciário",
  goal: "Passar no concurso do INSS",
  language: "pt",
};

const money = {
  course: "Everyday math",
  goal: "Handle money at my new retail job",
  language: "en",
};

const genetics = { course: "Biologia", goal: "Passar no ENEM", language: "pt" };

/**
 * Batches shaped like one chapter of a course outline: the chapter, its lessons and their skills,
 * written together as production asks for them. Every item must still find its own target.
 */
const BATCH_TEST_CASES: LibrarySearchTermsTestCase[] = [
  batchCase({
    id: "pt-batch-chapter-dependents",
    items: [
      searchItem(
        {
          goal: inss.goal,
          item: {
            courses: [inss.course],
            description: "Quem são os dependentes do segurado no RGPS e como provam essa condição",
            level: "beginner",
            objectives: [
              "Identificar as classes de dependentes",
              "Reconhecer a dependência econômica presumida e a comprovada",
            ],
            title: "Dependentes previdenciários",
          },
          kind: "chapter",
          language: inss.language,
        },
        libraryWith(
          "Beneficiários da pensão por morte. Cônjuge, companheiro, filhos e pais do segurado falecido e a ordem entre eles",
          "Segurados obrigatórios do RGPS. Empregado, contribuinte individual e segurado especial",
          "Salário-maternidade. Quem recebe e por quanto tempo",
        ),
      ),
      searchItem(
        lesson(inss, {
          description: "Os dependentes se dividem em três classes, e a primeira exclui as demais",
          skills: ["Classificar dependentes do segurado"],
          title: "Classes de dependentes",
        }),
        libraryWith(
          "Hierarquia entre beneficiários. Cônjuge e filhos vêm antes dos pais, e os pais antes dos irmãos",
          "Qualidade de segurado. Manter a proteção sem contribuir por um tempo",
          "Carência. Número mínimo de contribuições para um benefício",
        ),
      ),
      searchItem(
        lesson(inss, {
          description:
            "Para a primeira classe, a dependência econômica é presumida; para as outras, precisa ser comprovada",
          skills: ["Diferenciar dependência presumida e comprovada"],
          title: "Dependência econômica presumida",
        }),
        libraryWith(
          "Prova de sustento pelo segurado. Quando a lei dispensa a comprovação e quando ela é exigida",
          "Cálculo da renda mensal inicial. Média dos salários de contribuição",
          "União estável. Como provar a convivência",
        ),
      ),
      searchItem(
        lesson(inss, {
          description:
            "Casamento, maioridade ou fim da invalidez encerram a condição de dependente",
          skills: ["Identificar causas de perda da qualidade de dependente"],
          title: "Perda da condição de dependente",
        }),
        libraryWith(
          "Fim da cota de pensão do filho. Aos 21 anos, pelo casamento ou quando a invalidez termina",
          "Auxílio-reclusão. Benefício para a família do segurado preso",
          "Aposentadoria por incapacidade permanente. Quando a doença impede o trabalho",
        ),
      ),
      searchItem(
        skill(inss, {
          description: "Enquadrar cada pessoa na classe de dependentes certa",
          title: "Classificar dependentes do segurado",
        }),
        libraryWith(
          "Enquadrar cônjuge, filhos, pais e irmãos na ordem de beneficiários do RGPS",
          "Classificar segurados obrigatórios e facultativos",
          "Calcular o período de carência",
        ),
      ),
      searchItem(
        skill(inss, {
          description: "Saber quando a dependência econômica precisa de prova",
          title: "Diferenciar dependência presumida e comprovada",
        }),
        libraryWith(
          "Reconhecer quando a lei presume a dependência econômica e quando o beneficiário precisa demonstrá-la",
          "Comprovar tempo de contribuição com documentos",
          "Diferenciar aposentadoria por idade e por tempo de contribuição",
        ),
      ),
      searchItem(
        skill(inss, {
          description: "Reconhecer os fatos que encerram a condição de dependente",
          title: "Identificar causas de perda da qualidade de dependente",
        }),
        libraryWith(
          "Reconhecer os fatos que encerram a cota de pensão: maioridade, casamento e fim da invalidez",
          "Reconhecer a perda da qualidade de segurado após o período de graça",
          "Identificar causas de suspensão do auxílio por incapacidade",
        ),
      ),
    ],
  }),
  batchCase({
    id: "en-batch-chapter-percentages",
    items: [
      searchItem(
        {
          goal: money.goal,
          item: {
            courses: [money.course],
            description: "Use percentages to compare prices, discounts and tax",
            level: "beginner",
            objectives: [
              "Work out a percentage of an amount",
              "Find the price after a percent change",
            ],
            title: "Percentages in everyday money",
          },
          kind: "chapter",
          language: money.language,
        },
        libraryWith(
          "Percent calculations for shopping and bills. Sale prices, tips, sales tax and markups",
          "Fractions and decimals. Convert between fractions, decimals and ratios",
          "Personal budgeting. Track income and expenses each month",
        ),
      ),
      searchItem(
        lesson(money, {
          description: "Work out 15% of a bill or 20% of a salary",
          skills: ["Calculate a percentage of a number"],
          title: "Find a percentage of an amount",
        }),
        libraryWith(
          "Percent of a quantity. Multiply by the rate as a decimal, as in 15% of 80",
          "Ratios and rates. Compare two quantities as a ratio",
          "Simple interest. Interest on the original sum each year",
        ),
      ),
      searchItem(
        lesson(money, {
          description: "Find what you pay at the register when tax is added",
          skills: ["Add a percentage to a price"],
          title: "Add sales tax to a price",
        }),
        libraryWith(
          "Tax at checkout. Apply the tax rate to find the total, including VAT",
          "Tips at restaurants. Work out a tip on a bill",
          "Store markups. How shops set a selling price above cost",
        ),
      ),
      searchItem(
        lesson(money, {
          description: "Describe how much a price went up or down as a percent",
          skills: ["Calculate percent change"],
          title: "Percent increase and decrease",
        }),
        libraryWith(
          "Relative change in prices. Growth or decline of a value compared with the original",
          "Compound interest. Interest earned on interest over years",
          "Reading line graphs. Spot trends over time",
        ),
      ),
      searchItem(
        skill(money, {
          description: "Work out a part of a whole given as a percent",
          title: "Calculate a percentage of a number",
        }),
        libraryWith(
          "Find part of a whole from a percent rate",
          "Convert a fraction to a decimal",
          "Find the average of a list of numbers",
        ),
      ),
      searchItem(
        skill(money, {
          description: "Increase a price by a percent, such as tax or a tip",
          title: "Add a percentage to a price",
        }),
        libraryWith(
          "Increase an amount by a given percent",
          "Subtract a discount from a price",
          "Round an amount to the nearest cent",
        ),
      ),
      searchItem(
        skill(money, {
          description: "Find how much a value went up or down relative to where it started",
          title: "Calculate percent change",
        }),
        libraryWith(
          "Relative change between two values, as an increase or a decrease",
          "Compare two fractions",
          "Find the difference between two dates",
        ),
      ),
    ],
  }),
  batchCase({
    id: "pt-batch-lessons-skills-genetics",
    items: [
      searchItem(
        lesson(genetics, {
          description:
            "Cada característica é determinada por um par de fatores que se separam na formação dos gametas",
          skills: ["Aplicar a lei da segregação"],
          title: "Primeira lei de Mendel",
        }),
        libraryWith(
          "Segregação dos alelos na meiose. Monoibridismo e proporção 3:1",
          "Mitose. Divisão celular que forma células iguais",
          "Evolução por seleção natural. Darwin e a adaptação",
        ),
      ),
      searchItem(
        lesson(genetics, {
          description: "Prever os descendentes de um cruzamento",
          skills: ["Montar um quadro de Punnett"],
          title: "Cruzamentos e quadro de Punnett",
        }),
        libraryWith(
          "Tabela de gametas para prever genótipo e fenótipo dos descendentes",
          "Heredograma. Ler a árvore genealógica de uma família",
          "Mutações genéticas. Alterações no DNA",
        ),
      ),
      searchItem(
        lesson(genetics, {
          description: "Por que um alelo pode esconder o outro",
          skills: ["Identificar alelos dominantes e recessivos"],
          title: "Dominância e recessividade",
        }),
        libraryWith(
          "Alelo que se expressa sobre o outro. Heterozigoto e homozigoto",
          "Codominância e herança intermediária. Flores rosas de pais vermelho e branco",
          "Grupos sanguíneos ABO. Alelos múltiplos",
        ),
      ),
      searchItem(
        lesson(genetics, {
          description: "Características diferentes são herdadas de forma independente",
          skills: ["Aplicar a segregação independente"],
          title: "Segunda lei de Mendel",
        }),
        libraryWith(
          "Diibridismo. Dois genes em cromossomos diferentes e a proporção 9:3:3:1",
          "Ligação gênica e crossing-over",
          "Herança ligada ao sexo. Daltonismo e hemofilia",
        ),
      ),
      searchItem(
        skill(genetics, {
          description: "Usar a separação dos fatores para prever descendentes",
          title: "Aplicar a lei da segregação",
        }),
        libraryWith(
          "Prever a separação dos alelos na formação dos gametas",
          "Prever o número de cromossomos após a mitose",
          "Calcular a frequência de alelos em uma população",
        ),
      ),
      searchItem(
        skill(genetics, {
          description: "Organizar os gametas numa tabela para prever os filhos",
          title: "Montar um quadro de Punnett",
        }),
        libraryWith(
          "Combinar os gametas numa grade e ler as proporções de genótipo",
          "Construir um heredograma",
          "Ler uma tabela periódica",
        ),
      ),
      searchItem(
        skill(genetics, {
          description: "Saber qual alelo aparece no fenótipo",
          title: "Identificar alelos dominantes e recessivos",
        }),
        libraryWith(
          "Reconhecer o gene dominante que se expressa no heterozigoto",
          "Identificar organelas da célula animal",
          "Reconhecer mutações silenciosas",
        ),
      ),
      searchItem(
        skill(genetics, {
          description: "Prever descendentes quando dois genes são herdados juntos",
          title: "Aplicar a segregação independente",
        }),
        libraryWith(
          "Resolver problemas de diibridismo com dois genes",
          "Resolver problemas de herança ligada ao X",
          "Aplicar a lei de Hardy-Weinberg",
        ),
      ),
    ],
  }),
];

export const TEST_CASES: LibrarySearchTermsTestCase[] = [...SINGLE_TEST_CASES, ...BATCH_TEST_CASES];
