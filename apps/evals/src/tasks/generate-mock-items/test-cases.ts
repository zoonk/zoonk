import { type OptionalCountry, type TestCase } from "@/lib/types";
import { type GenerateItemsParams } from "@zoonk/ai/tasks/items/generate";

type GenerateMockItemsInput = Omit<
  OptionalCountry<GenerateItemsParams>,
  "model" | "purpose" | "reasoning" | "useFallback"
>;

export type ReleasedQuestion = { text: string; key: string };

export type GenerateMockItemsExpected = { command: string; released: ReleasedQuestion[] };

const COUNT = 5;

/**
 * The CGU's 2026 notice (Cebraspe) as production holds it: certo/errado items where a wrong answer
 * takes away a right one's points. Its own papers aren't out yet, so released questions come from
 * Cebraspe's 2022 paper for SECONT-ES state auditors, the closest internal-control post, with the
 * official final key (690_SECONT_ES_CG1_01).
 */
const CGU = {
  name: "Concurso CGU",
  style: "Banca Cebraspe. trueFalse: itens para julgamento individual como Certo ou Errado.",
  wrongPenalty: 1,
};

const BUDGET_COMMAND =
  "Julgue os itens que se seguem, acerca da administração financeira e orçamentária pública brasileira.";

const JUDICIAL_REVIEW_COMMAND =
  "No que diz respeito ao controle de constitucionalidade, julgue os seguintes itens.";

const CONSTITUTION_COMMAND =
  "Considerando as disposições constitucionais acerca da administração pública e dos direitos e garantias fundamentais, julgue os itens a seguir.";

const PROCUREMENT_COMMAND =
  "À luz da Lei n.º 14.133/2021, que trata de licitações e contratos administrativos, julgue os itens subsequentes.";

const ADMINISTRATIVE_LAW_COMMAND =
  "Acerca de direito administrativo, julgue os itens que se seguem.";

const PUBLIC_PROPERTY_COMMAND = "Em relação a bens públicos, julgue os itens seguintes.";

const AUDIT_COMMAND =
  "Acerca da auditoria interna, de suas características e importância para o serviço público, julgue os itens seguintes.";

const RISK_COMMAND =
  "Em relação à estrutura da gestão de riscos, definida, segundo a ABNT NBR ISO 31000, como o conjunto de componentes que fornecem os fundamentos e os arranjos organizacionais para a concepção, implementação, monitoramento, análise crítica e melhoria contínua da gestão de riscos, julgue os itens a seguir.";

const ETHICS_COMMAND =
  "Com base no que dispõe o Código de Conduta Ética dos Servidores da Secretaria de Controle e Transparência do Estado do Espírito Santo, julgue os itens subsequentes.";

function item(command: string, text: string): string {
  return `${command}\n${text}`;
}

function released(command: string, text: string, isTrue: boolean): ReleasedQuestion {
  return { key: isTrue ? "true" : "false", text: item(command, text) };
}

const EXPECTATIONS =
  "Original Cebraspe certo/errado items for the CGU mock, as hard as the released items the blind judge mixes them with and indistinguishable from them in wording, length and traps. Each item turns on one exact condition a prepared candidate can decide for sure, since a wrong answer cancels a right one. None restates, negates or renames a used situation or a past question.";

export const TEST_CASES: TestCase<GenerateMockItemsExpected, GenerateMockItemsInput>[] = [
  {
    expectations: EXPECTATIONS,
    expected: {
      command: BUDGET_COMMAND,
      released: [
        released(
          BUDGET_COMMAND,
          "Destaques são descentralizações externas que ocorrem entre unidades de órgãos distintos.",
          true,
        ),
        released(
          BUDGET_COMMAND,
          "Entes governamentais podem realizar repasses de recursos públicos a entidades privadas. Exemplo dessa prerrogativa, o Tesouro Nacional pode realizar operação de redesconto, a qual, por sua vez, demanda lei específica, independentemente do prazo que for concedido ao ente privado para liquidação.",
          false,
        ),
        released(
          BUDGET_COMMAND,
          "As despesas empenhadas, não liquidadas e não pagas advêm de uma despesa extra-orçamentária e a sua inscrição constitui receita orçamentária.",
          false,
        ),
      ],
    },
    id: "pt-cebraspe-cgu-budget-law",
    language: "pt",
    userInput: {
      count: COUNT,
      examFormat: {
        ...CGU,
        pastQuestions: [
          item(
            BUDGET_COMMAND,
            "Os créditos adicionais suplementares têm a finalidade de reforçar programas com dotação orçamentária existente e são constituídos para despesas urgentes e previsíveis.",
          ),
          item(
            BUDGET_COMMAND,
            "O excesso de recursos financeiros advindos de arrecadação poderá ser aplicado em programa de governo não previsto na lei orçamentária anual, mesmo sem que haja autorização legislativa para tal.",
          ),
        ],
      },
      format: "trueFalse",
      language: "pt",
      level: "beginner",
      skill: {
        description:
          "Aplicar normas gerais de direito financeiro sobre orçamento, receitas e despesas públicas.",
        name: "Aplicar normas gerais de direito financeiro",
      },
      usedSituations: [
        "Valéria verifica que um tributo foi lançado em 2025 e arrecadado em 2026. Para fins orçamentários, a receita pertence ao exercício financeiro de 2026.",
        "Danilo constatou que materiais solicitados por um órgão público foram entregues sem empenho prévio. Nessa situação, o órgão pode pagar a despesa sem empenhá-la, pois a entrega já ocorreu.",
        "Iara identificou, no balanço patrimonial do exercício anterior, superávit financeiro não comprometido de recursos legalmente vinculados à saúde. Esse superávit pode ser indicado como fonte para abrir ",
      ],
    },
  },
  {
    expectations: EXPECTATIONS,
    expected: {
      command: JUDICIAL_REVIEW_COMMAND,
      released: [
        released(
          JUDICIAL_REVIEW_COMMAND,
          "O único legitimado ativo para a propositura de ação direta de inconstitucionalidade interventiva, no Supremo Tribunal Federal, é o procurador-geral da República, quando lei ou ato normativo federal, estadual ou distrital contrariar princípios sensíveis da Constituição Federal.",
          true,
        ),
        released(
          CONSTITUTION_COMMAND,
          "Suponha-se que X seja prefeito e Y, vereador no município de Vila Velha - ES, tendo sido eles eleitos pelo mesmo partido e os mais votados na eleição municipal. Suponha-se, ainda, que ambos planejem mudar de partido em razão de insatisfação com o programa partidário. Nessa situação, a mudança de partido no primeiro ano do mandato ensejará a perda dos cargos de X e de Y.",
          false,
        ),
        released(
          CONSTITUTION_COMMAND,
          "O estrangeiro de qualquer nacionalidade, desde que naturalizado brasileiro, pode assumir o cargo de auditor do estado.",
          true,
        ),
        released(
          CONSTITUTION_COMMAND,
          "A iniciativa popular, a autoria de ação popular e o exercício da soberania popular pelo sufrágio universal e pelo voto direto e secreto são modalidades por meio das quais o cidadão pode exercer direitos políticos.",
          true,
        ),
      ],
    },
    id: "pt-cebraspe-cgu-judicial-review",
    language: "pt",
    userInput: {
      count: COUNT,
      examFormat: {
        ...CGU,
        pastQuestions: [
          item(
            JUDICIAL_REVIEW_COMMAND,
            "A declaração incidental de inconstitucionalidade de lei pode constituir a causa de pedir de uma ação popular.",
          ),
          item(
            JUDICIAL_REVIEW_COMMAND,
            "Ação direta de inconstitucionalidade de competência do tribunal de justiça do estado pode ter por objeto de controle lei federal que ofenda a constituição estadual.",
          ),
        ],
      },
      format: "trueFalse",
      language: "pt",
      level: "intermediate",
      skill: {
        description:
          "Distinguir modalidades e efeitos do controle de constitucionalidade no Brasil.",
        name: "Aplicar regras de controle de constitucionalidade",
      },
      usedSituations: [
        "Otávio acompanha uma ação direta de inconstitucionalidade em que o STF declara inconstitucional uma lei federal aplicada durante muitos anos.",
        "Em recurso extraordinário interposto em processo individual, o STF declarou definitivamente inconstitucional uma lei municipal em face da Constituição Federal. Débora analisa as consequências da decis",
        "Wesley analisa uma lei municipal editada após a Constituição Federal de 1988, cuja aplicação pode ofender preceito fundamental.",
      ],
    },
  },
  {
    expectations: EXPECTATIONS,
    expected: {
      command: PROCUREMENT_COMMAND,
      released: [
        released(
          PROCUREMENT_COMMAND,
          "A lei prevê, em regra, sete etapas sequenciais do processo de licitação, o qual se inicia na fase preparatória e se encerra na fase de homologação.",
          true,
        ),
        released(
          ADMINISTRATIVE_LAW_COMMAND,
          "Segundo o critério teleológico, o direito administrativo é definido como o sistema dos princípios jurídicos que regulam a atividade do Estado para o cumprimento de seus fins.",
          true,
        ),
        released(
          ADMINISTRATIVE_LAW_COMMAND,
          "Dada a origem francesa do direito administrativo pátrio, a jurisprudência, no Brasil, assim como ocorre na França, revela-se a principal fonte do direito administrativo.",
          false,
        ),
        released(
          PUBLIC_PROPERTY_COMMAND,
          "Os bens de uso comum do povo e os bens de uso especial têm como características a imprescritibilidade, a impenhorabilidade e a impossibilidade de oneração, que decorrem da inalienabilidade; porém, a inalienabilidade dos bens dessas duas modalidades é relativizada caso, sendo suscetíveis esses bens de valoração patrimonial, ocorra a perda da sua destinação pública, que se dá por meio da desafetação.",
          true,
        ),
        released(
          PUBLIC_PROPERTY_COMMAND,
          "No direito brasileiro, os bens públicos são classificados segundo o critério de sua destinação ou afetação, sendo definidos como bens dominicais os que se destinam à consecução específica de determinado objetivo da administração pública.",
          false,
        ),
      ],
    },
    id: "pt-cebraspe-cgu-procurement-law",
    language: "pt",
    userInput: {
      count: COUNT,
      examFormat: {
        ...CGU,
        pastQuestions: [
          item(
            PROCUREMENT_COMMAND,
            "Em atenção ao princípio da vinculação ao edital, as propostas que contiverem vícios, ainda que sanáveis, serão desclassificadas na fase de julgamento do processo de licitação.",
          ),
          item(
            PROCUREMENT_COMMAND,
            "A designação de agentes públicos para o desempenho das funções essenciais à execução da lei em referência caberá à autoridade máxima do órgão ou da entidade, que, entre outros critérios, indicará, necessariamente, servidor efetivo ou empregado público dos quadros permanentes da administração pública para desempenhar as referidas funções.",
          ),
        ],
      },
      format: "trueFalse",
      language: "pt",
      level: "intermediate",
      skill: {
        description:
          "Aplicar as regras da Lei nº 14.133/2021 sobre fases da licitação, julgamento das propostas, agentes de contratação e contratos administrativos.",
        name: "Aplicar a Lei de Licitações e Contratos",
      },
    },
  },
  {
    expectations: EXPECTATIONS,
    expected: {
      command: AUDIT_COMMAND,
      released: [
        released(
          AUDIT_COMMAND,
          "Para que sejam mitigados, os riscos de fraude e corrupção requerem controles específicos, o que implica à alta administração, com apoio de unidades especializadas como, por exemplo, o comitê de ética ou o comitê de riscos, o dever de gerenciar a probabilidade de ocorrência de fraude e corrupção que atente contra a boa e regular gestão dos bens e recursos públicos.",
          true,
        ),
        released(
          RISK_COMMAND,
          "Os arranjos organizacionais incluem planos, relacionamentos, responsabilidades, recursos, processos e atividades da organização.",
          true,
        ),
        released(
          RISK_COMMAND,
          "Conceitualmente, a estrutura da gestão de riscos está incorporada ao âmbito das políticas e práticas estratégicas e operacionais de toda a organização.",
          true,
        ),
        released(
          ETHICS_COMMAND,
          "Considerando o princípio da publicidade, as informações obtidas nas atividades realizadas pelo auditor do Estado devem ser reveladas em sua completude aos cidadãos.",
          false,
        ),
        released(
          ETHICS_COMMAND,
          "Ao auditor do estado do Espírito Santo que necessite dirimir dúvidas relacionadas à conduta ética e a práticas ou situações que possam configurar conflito de interesse cabe consultar, em primeiro lugar, a Comissão de Ética da Secretaria de Controle e Transparência do Estado do Espírito Santo, que, em seu turno, poderá remeter a demanda recebida ao Conselho de Ética Pública do Estado do Espírito Santo.",
          true,
        ),
      ],
    },
    id: "pt-cebraspe-cgu-audit-standards",
    language: "pt",
    userInput: {
      count: COUNT,
      examFormat: {
        ...CGU,
        pastQuestions: [
          item(
            AUDIT_COMMAND,
            "A auditoria interna poderá agregar valor oferecendo serviços de consultoria, destinados a melhorar os processos de governança, gerenciamento de riscos e controle, desde que não assuma responsabilidades de gestão.",
          ),
          item(
            AUDIT_COMMAND,
            "Os auditores internos são responsáveis por implementar medidas de controle preventivas, de detecção e corretivas nos processos sob sua responsabilidade e sob a responsabilidade de terceiros, especificamente para manter um controle interno efetivo.",
          ),
        ],
      },
      format: "trueFalse",
      language: "pt",
      level: "beginner",
      skill: {
        description:
          "Distinguir objetivos, tipos, princípios e normas aplicáveis à auditoria governamental.",
        name: "Distinguir tipos e normas de auditoria",
      },
      usedSituations: [
        "Nayara integra uma equipe que avalia um programa federal de capacitação. Entre as questões examinadas estão a observância das regras de seleção dos participantes e a relação entre os recursos empregad",
        "Rosana integra uma equipe encarregada de opinar sobre as demonstrações contábeis de um órgão federal, considerando a estrutura de relatório financeiro aplicável.",
        "Leandro examina se o prazo médio de atendimento dos pedidos de aposentadoria em uma unidade do INSS ficou dentro da meta fixada no plano administrativo.",
        "Antes de integrar uma equipe de auditoria, Valéria elaborou a minuta de um edital federal cuja regularidade a equipe agora examinará. Ela declarou formalmente que atuará com isenção.",
      ],
    },
  },
];
