import { type TestCase } from "@/lib/types";
import {
  type CheckRecallOverlapParams,
  type RecallQuestion,
} from "@zoonk/ai/tasks/items/check-recall-overlap";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";

export type CheckRecallOverlapInput = Pick<
  CheckRecallOverlapParams,
  "candidates" | "earlier" | "skill"
>;

/** For each candidate in order, the 1-based number of the earlier question it repeats, or null when it's new. */
export type CheckRecallOverlapExpected = { repeats: (number | null)[] };

function statement({
  context = null,
  isTrue,
  text,
}: {
  context?: string | null;
  isTrue: boolean;
  text: string;
}): GeneratedItem {
  return {
    context,
    difficulty: "medium",
    format: "trueFalse",
    image: null,
    isTrue,
    misconception: null,
    reason: "",
    statement: text,
    visual: null,
  };
}

function earlier(question: string, isTrue: boolean): RecallQuestion {
  return { answer: isTrue ? "true" : "false", question };
}

/**
 * Earlier questions are the CGU (Cebraspe, 2026) bank's own, as production held them on 20 Nov
 * 2026; candidates restate, negate or rename them, or ask the same skill in a case of its own.
 */
export const TEST_CASES: TestCase<CheckRecallOverlapExpected, CheckRecallOverlapInput>[] = [
  {
    expectations:
      "1 renames the extension case and negates it (the extension needs no consent), so it repeats earlier 2. 2 states the rule of earlier 1 without its case, negated: remembering that partial access is due answers it. 3 (pointing to where public information is already published) and 4 (no reasons needed for a request) test other rules of the law.",
    expected: { repeats: [2, 1, null, null] },
    id: "pt-cgu-access-to-information",
    language: "pt",
    userInput: {
      candidates: [
        statement({
          context:
            "Fernanda pediu uma informação a um órgão federal. Antes de vencido o prazo de 20 dias, o órgão comunicou a ela, de forma justificada, que precisaria de mais 10 dias.",
          isTrue: false,
          text: "Nessa situação, a prorrogação depende da concordância de Fernanda.",
        }),
        statement({
          isTrue: true,
          text: "Quando um documento solicitado contém informações pessoais de acesso restrito que podem ser ocultadas sem prejuízo da compreensão do restante, o órgão deve conceder acesso à parte não restrita.",
        }),
        statement({
          context:
            "Gustavo pediu a um órgão federal uma informação que já está publicada, em formato aberto, no portal de transparência do órgão.",
          isTrue: true,
          text: "Nessa situação, o órgão pode atender ao pedido indicando a Gustavo o local onde ele pode consultar a informação.",
        }),
        statement({
          isTrue: false,
          text: "O pedido de acesso de Bruno a informações de interesse público deve vir acompanhado dos motivos que o justificam.",
        }),
      ],
      earlier: [
        earlier(
          "Raíssa pediu a um órgão público acesso a um relatório que contém informações pessoais de acesso restrito. Os trechos restritos podem ser ocultados sem impedir a compreensão das demais partes.\nA presença das informações pessoais autoriza, por si só, a negativa de acesso a todo o relatório.",
          false,
        ),
        earlier(
          "Um órgão federal não pôde atender imediatamente ao pedido de informação de Fábio. Antes do fim do prazo inicial de 20 dias, comunicou a ele uma justificativa expressa para a prorrogação por mais 10 dias.\nA prorrogação pode ocorrer independentemente da concordância de Fábio.",
          true,
        ),
        earlier(
          "Cíntia teve negado um pedido de acesso à informação por um órgão do Poder Executivo federal e pretende recorrer da decisão dentro do prazo legal.\nCíntia deve dirigir seu primeiro recurso diretamente à Controladoria-Geral da União, dispensada a apreciação por autoridade hierarquicamente superior à que negou o pedido.",
          false,
        ),
      ],
      skill: {
        description:
          "Aplicar regras da Lei de Acesso à Informação sobre transparência, pedidos e restrições de acesso.",
        name: "Aplicar a Lei de Acesso à Informação",
      },
    },
  },
  {
    expectations:
      "1 moves earlier 2's absence from 30 to 31 days: the same case across the same threshold, so remembering why 30 days isn't abandonment answers it. 2 is habitual absence on scattered days, another rule. 3 restates earlier 5's preventive leave without its case. 4 asks who may chair the committee, not who may be the appointed defender of earlier 4.",
    expected: { repeats: [2, null, 5, null] },
    id: "pt-cgu-disciplinary-process",
    language: "pt",
    userInput: {
      candidates: [
        statement({
          isTrue: true,
          text: "Caio, servidor público federal regido pela Lei nº 8.112/1990, ausentou-se intencional e injustificadamente do serviço por 31 dias consecutivos. Nessa situação, a ausência configura abandono de cargo.",
        }),
        statement({
          isTrue: false,
          text: "Heloísa, servidora pública federal regida pela Lei nº 8.112/1990, faltou ao serviço sem causa justificada por 40 dias, de forma interpolada, durante um período de 12 meses. Nessa situação, ela está sujeita à demissão por inassiduidade habitual.",
        }),
        statement({
          isTrue: true,
          text: "Segundo a Lei nº 8.112/1990, o afastamento preventivo do servidor acusado, determinado para evitar que ele influa na apuração, pode durar até 60 dias, prorrogáveis por igual prazo, sem prejuízo da remuneração, e seus efeitos cessam ao fim da prorrogação ainda que o processo não esteja concluído.",
        }),
        statement({
          context:
            "A autoridade competente vai constituir a comissão de processo disciplinar que apurará a conduta de Marcelo, servidor público federal regido pela Lei nº 8.112/1990.",
          isTrue: false,
          text: "Nessa situação, o presidente da comissão poderá ser servidor ocupante de cargo efetivo de nível inferior ao de Marcelo, desde que seja estável.",
        }),
      ],
      earlier: [
        earlier(
          "A conduta de Otávio, servidor público federal regido pela Lei nº 8.112/1990, foi objeto de investigação preliminar informativa, sem aplicação de penalidade. Depois, foi instaurado processo administrativo disciplinar no qual lhe foram assegurados o contraditório e a ampla defesa.\nA ausência de contraditório na investigação preliminar, por si só, torna nulo o processo administrativo disciplinar posteriormente instaurado.",
          false,
        ),
        earlier(
          "Danilo, servidor público federal regido pela Lei nº 8.112/1990, ausentou-se intencional e injustificadamente do serviço por 30 dias consecutivos e retornou no 31º dia. Nessa situação, a ausência configura abandono de cargo.",
          false,
        ),
        earlier(
          "Ao aplicar a Iara, servidora pública federal, uma suspensão de 20 dias, a autoridade competente poderá, por conveniência para o serviço, converter a penalidade em multa de 50% por dia de vencimento ou remuneração, ficando Iara obrigada a permanecer em serviço.",
          true,
        ),
        earlier(
          "No processo disciplinar de Otávio, regido pela Lei nº 8.112/1990, o prazo para defesa escrita transcorreu sem manifestação, embora ele tenha sido regularmente citado. A autoridade instauradora deverá designar defensor dativo e poderá escolher servidor ocupante de cargo efetivo de mesmo nível que o de Otávio, ainda que não seja advogado.",
          true,
        ),
        earlier(
          "No curso de processo disciplinar regido pela Lei nº 8.112/1990 contra Leandro, servidor público federal, a autoridade instauradora identifica risco concreto de interferência dele na apuração.\nA autoridade instauradora poderá determinar o afastamento preventivo de Leandro do exercício do cargo por 60 dias, sem prejuízo da remuneração, e prorrogá-lo por igual período. Após a prorrogação, os efeitos do afastamento cessarão, mesmo que o processo não tenha sido concluído.",
          true,
        ),
        earlier(
          "Em processo disciplinar regido pela Lei nº 8.112/1990, Valéria, servidora pública federal, pede perícia grafotécnica apenas para identificar os dias em que estava escalada, conforme documento legível e de autenticidade incontroversa.\nNessa situação, o presidente da comissão poderá indeferir a perícia por decisão fundamentada, sem que isso, por si só, viole a ampla defesa.",
          true,
        ),
      ],
      skill: {
        description:
          "Aplicar regras de apuração disciplinar, contraditório e penalidades no serviço público federal.",
        name: "Analisar apuração e processo disciplinar",
      },
    },
  },
  {
    expectations:
      "1 negates earlier 1 (modulating the effects of an ADI ruling). 2 shares the Senate of earlier 2 but asks about concentrated review, which binds everyone without the Senate. 3 is earlier 3's case renamed with a year added. 4 asks what a declaratory action may target, another rule.",
    expected: { repeats: [1, null, 3, null] },
    id: "pt-cgu-judicial-review",
    language: "pt",
    userInput: {
      candidates: [
        statement({
          isTrue: false,
          text: "Declarada em ação direta a inconstitucionalidade de lei federal, o STF não pode restringir os efeitos da decisão, que retroagem necessariamente à data de edição da lei.",
        }),
        statement({
          context:
            "O STF julgou procedente uma ação direta de inconstitucionalidade contra uma lei estadual que contrariava a Constituição Federal.",
          isTrue: false,
          text: "Nessa situação, a decisão só produzirá efeitos contra todos depois que o Senado Federal suspender a execução da lei.",
        }),
        statement({
          context:
            "Rafael examina uma lei municipal de 2005 cuja aplicação pode violar preceito fundamental da Constituição Federal.",
          isTrue: true,
          text: "Essa lei pode ser questionada por arguição de descumprimento de preceito fundamental no STF, mas não por ação direta de inconstitucionalidade nesse tribunal.",
        }),
        statement({
          isTrue: false,
          text: "A ação declaratória de constitucionalidade proposta no STF pode ter por objeto lei ou ato normativo estadual.",
        }),
      ],
      earlier: [
        earlier(
          "Otávio acompanha uma ação direta de inconstitucionalidade em que o STF declara inconstitucional uma lei federal aplicada durante muitos anos.\nPor razões de segurança jurídica, o STF pode, por maioria de dois terços de seus membros, determinar que a decisão produza efeitos apenas a partir de seu trânsito em julgado.",
          true,
        ),
        earlier(
          "Em recurso extraordinário interposto em processo individual, o STF declarou definitivamente inconstitucional uma lei municipal em face da Constituição Federal. Débora analisa as consequências da decisão.\nPor se tratar de lei municipal, o Senado Federal não tem competência para suspender sua execução, no todo ou em parte, com fundamento no art. 52, X, da Constituição.",
          false,
        ),
        earlier(
          "Wesley analisa uma lei municipal editada após a Constituição Federal de 1988, cuja aplicação pode ofender preceito fundamental.\nA lei pode ser questionada por arguição de descumprimento de preceito fundamental perante o STF, observados os demais requisitos, inclusive o da subsidiariedade, embora não possa ser objeto de ação direta de inconstitucionalidade nesse tribunal.",
          true,
        ),
      ],
      skill: {
        description:
          "Distinguir modalidades e efeitos do controle de constitucionalidade no Brasil.",
        name: "Aplicar regras de controle de constitucionalidade",
      },
    },
  },
  {
    expectations:
      "1 is earlier 1's case renamed and negated (revenue belongs to the year it's collected). 2 asks the expense side of the same article, which follows the commitment year: remembering the revenue rule doesn't answer it. 3 asks when the commitment note itself may be waived, not whether an expense can skip commitment.",
    expected: { repeats: [1, null, null] },
    id: "pt-cgu-public-finance-law",
    language: "pt",
    userInput: {
      candidates: [
        statement({
          isTrue: false,
          text: "Rodrigo verifica que um imposto lançado em dezembro de 2025 só foi arrecadado em janeiro de 2026. Para fins orçamentários, essa receita pertence ao exercício financeiro de 2025.",
        }),
        statement({
          isTrue: false,
          text: "Uma despesa empenhada em novembro de 2025 e paga em fevereiro de 2026 pertence, para fins orçamentários, ao exercício financeiro de 2026.",
        }),
        statement({
          isTrue: true,
          text: "Embora seja vedada a realização de despesa sem prévio empenho, a Lei nº 4.320/1964 admite, em casos especiais previstos na legislação específica, a dispensa da emissão da nota de empenho.",
        }),
      ],
      earlier: [
        earlier(
          "Valéria verifica que um tributo foi lançado em 2025 e arrecadado em 2026. Para fins orçamentários, a receita pertence ao exercício financeiro de 2026.",
          true,
        ),
        earlier(
          "Danilo constatou que materiais solicitados por um órgão público foram entregues sem empenho prévio. Nessa situação, o órgão pode pagar a despesa sem empenhá-la, pois a entrega já ocorreu.",
          false,
        ),
        earlier(
          "Iara identificou, no balanço patrimonial do exercício anterior, superávit financeiro não comprometido de recursos legalmente vinculados à saúde. Esse superávit pode ser indicado como fonte para abrir crédito suplementar destinado a obras de pavimentação urbana sem relação com a saúde.",
          false,
        ),
      ],
      skill: {
        description:
          "Aplicar normas gerais de direito financeiro sobre orçamento, receitas e despesas públicas.",
        name: "Aplicar normas gerais de direito financeiro",
      },
    },
  },
  {
    expectations:
      "1 is earlier 1 with another product and the same prices, so the remembered 25% answers it. 2 reverses the change (50 to 40 is a 20% fall, not 25%) and must be worked out. 3 uses new numbers. 4 asks earlier 2's question in other words.",
    expected: { repeats: [1, null, null, 2] },
    id: "en-percentage-change",
    language: "en",
    userInput: {
      candidates: [
        {
          context: null,
          difficulty: "easy",
          fixedOrder: false,
          format: "multipleChoice",
          image: null,
          options: [
            { isCorrect: true, misconception: null, reason: "", text: "25%" },
            {
              isCorrect: false,
              misconception: "Divided by the new price",
              reason: "",
              text: "20%",
            },
            { isCorrect: false, misconception: "Used the dollar change", reason: "", text: "10%" },
            { isCorrect: false, misconception: "Ratio of prices", reason: "", text: "125%" },
          ],
          question:
            "A concert ticket went from $40 to $50. By what percentage did its price go up?",
          visual: null,
        },
        {
          context: null,
          difficulty: "medium",
          fixedOrder: false,
          format: "multipleChoice",
          image: null,
          options: [
            { isCorrect: true, misconception: null, reason: "", text: "20%" },
            {
              isCorrect: false,
              misconception: "Divided by the new price",
              reason: "",
              text: "25%",
            },
            { isCorrect: false, misconception: "Used the dollar change", reason: "", text: "10%" },
            { isCorrect: false, misconception: "Ratio of prices", reason: "", text: "80%" },
          ],
          question: "A jacket's price dropped from $50 to $40. By what percentage did it fall?",
          visual: null,
        },
        {
          context: null,
          difficulty: "medium",
          fixedOrder: false,
          format: "multipleChoice",
          image: null,
          options: [
            { isCorrect: true, misconception: null, reason: "", text: "5% decrease" },
            {
              isCorrect: false,
              misconception: "Divided by the new rent",
              reason: "",
              text: "About 5.3% decrease",
            },
            {
              isCorrect: false,
              misconception: "Used the dollar change",
              reason: "",
              text: "60% decrease",
            },
            { isCorrect: false, misconception: "Wrong direction", reason: "", text: "5% increase" },
          ],
          question:
            "Ana's monthly rent went from $1,200 to $1,140. What was the percentage change?",
          visual: null,
        },
        {
          context: null,
          difficulty: "easy",
          fixedOrder: false,
          format: "multipleChoice",
          image: null,
          options: [
            {
              isCorrect: true,
              misconception: null,
              reason: "",
              text: "Divide the change by the original value",
            },
            {
              isCorrect: false,
              misconception: "Divided by the new value",
              reason: "",
              text: "Divide the change by the new value",
            },
            {
              isCorrect: false,
              misconception: "Ratio of values",
              reason: "",
              text: "Divide the new value by the original",
            },
          ],
          question:
            "To find a percentage change, what do you divide the difference between the two values by?",
          visual: null,
        },
      ],
      earlier: [
        {
          answer: "25%",
          question:
            "A shirt went from $40 to $50. What is the percentage increase?\n- 25%\n- 20%\n- 10%\n- 125%",
        },
        {
          answer: "The original value",
          question:
            "When you work out a percentage change, which value goes in the denominator?\n- The original value\n- The new value\n- The difference",
        },
      ],
      skill: {
        description: "Work out the percentage increase or decrease between two values.",
        name: "Calculate percentage change",
      },
    },
  },
];
