import { type Localized, t } from "../../_utils/localize";

function cited(sourceId: string) {
  return <Fields extends object>(text: Localized, fields?: Fields) => ({
    ...fields,
    citation: { passage: text.in("pt"), sourceId },
    text,
  });
}

const handbookCriteria = [
  {
    awards: [
      t(
        "Shows no command of formal written Portuguese.",
        "Desconhece a modalidade escrita formal.",
      ),
      t(
        "Very weak command, with varied and frequent errors throughout the text.",
        "Domínio precário, com desvios diversificados e frequentes em todo o texto.",
      ),
      t(
        "Insufficient command, with many errors in grammar, register, and writing conventions.",
        "Domínio insuficiente, com muitos desvios de gramática, de escolha de registro e de convenções da escrita.",
      ),
      t(
        "Moderate command, with some errors or incomplete sentences.",
        "Domínio mediano, com alguns desvios ou períodos truncados.",
      ),
      t("Good command, with few errors.", "Bom domínio, com poucos desvios."),
      t(
        "Excellent command, with isolated errors allowed when they do not recur.",
        "Excelente domínio: desvios só como exceção, quando não se repetem.",
      ),
    ],
    id: "c1",
    text: t(
      "Command of formal written Portuguese",
      "Domínio da modalidade escrita formal da língua portuguesa",
    ),
  },
  {
    awards: [
      t(
        "Goes off topic or fails to use the argumentative essay form.",
        "Foge ao tema ou não atende ao tipo dissertativo-argumentativo.",
      ),
      t(
        "Addresses only the broader subject or consistently shows features of other text types.",
        "Tangencia o tema ou tem traços constantes de outros tipos textuais.",
      ),
      t(
        "Copies portions of the source texts or lacks a clear thesis, argument, and conclusion.",
        "Copia trechos dos textos motivadores ou não tem proposição, argumentação e conclusão claras.",
      ),
      t(
        "Uses predictable arguments and shows moderate command of the essay form.",
        "Argumentação previsível e domínio mediano do tipo textual.",
      ),
      t(
        "Develops consistent arguments and shows good command of the essay form, with a thesis, argument, and conclusion.",
        "Argumentação consistente e bom domínio do tipo textual, com proposição, argumentação e conclusão.",
      ),
      t(
        "Develops consistent arguments using productive sociocultural references and shows excellent command of the essay form.",
        "Argumentação consistente, com repertório sociocultural produtivo, e excelente domínio do tipo textual.",
      ),
    ],
    id: "c2",
    text: t(
      "Understanding the prompt and applying concepts from different fields to develop the topic in an argumentative essay",
      "Compreensão da proposta e uso de conceitos de várias áreas para desenvolver o tema, no texto dissertativo-argumentativo",
    ),
  },
  {
    awards: [
      t(
        "Presents information unrelated to the topic and defends no point of view.",
        "Informações não relacionadas ao tema e sem defesa de um ponto de vista.",
      ),
      t(
        "Presents weakly related or incoherent information and defends no point of view.",
        "Informações pouco relacionadas ao tema ou incoerentes, sem defesa de um ponto de vista.",
      ),
      t(
        "Presents disorganized or contradictory information limited to the source texts.",
        "Informações desorganizadas ou contraditórias, limitadas aos textos motivadores.",
      ),
      t(
        "Presents poorly organized information limited to the source texts’ arguments.",
        "Informações limitadas aos argumentos dos textos motivadores e pouco organizadas.",
      ),
      t(
        "Presents organized information with some independent reasoning.",
        "Informações organizadas, com indícios de autoria.",
      ),
      t(
        "Presents consistent, organized information that demonstrates independent reasoning.",
        "Informações consistentes e organizadas, configurando autoria.",
      ),
    ],
    id: "c3",
    text: t(
      "Selecting, connecting, organizing, and interpreting information, facts, opinions, and arguments in defense of a point of view",
      "Seleção, relação, organização e interpretação de informações, fatos, opiniões e argumentos em defesa de um ponto de vista",
    ),
  },
  {
    awards: [
      t("Does not connect the information.", "Não articula as informações."),
      t("Connects parts of the text weakly.", "Articula as partes do texto de forma precária."),
      t(
        "Links ideas poorly, with many inappropriate choices and a limited range of cohesive devices.",
        "Articulação insuficiente, com muitas inadequações e repertório limitado de recursos coesivos.",
      ),
      t(
        "Links ideas moderately well, with inappropriate choices and little variety in cohesive devices.",
        "Articulação mediana, com inadequações e repertório pouco diversificado de recursos coesivos.",
      ),
      t(
        "Links parts of the text with few inappropriate choices and a varied range of cohesive devices.",
        "Articula as partes com poucas inadequações e repertório diversificado de recursos coesivos.",
      ),
      t(
        "Links parts of the text effectively using a varied range of cohesive devices.",
        "Articula bem as partes do texto, com repertório diversificado de recursos coesivos.",
      ),
    ],
    id: "c4",
    text: t(
      "Language choices that connect and develop the argument",
      "Mecanismos linguísticos necessários para a construção da argumentação",
    ),
  },
];

function interventionCriterion({
  handbookRule,
  manualRule,
}: {
  handbookRule: ReturnType<typeof cited>;
  manualRule: ReturnType<typeof cited>;
}) {
  return handbookRule(
    t(
      "Proposing an intervention for the problem while respecting human rights",
      "Proposta de intervenção para o problema abordado, respeitando os direitos humanos",
    ),
    {
      awards: [
        handbookRule(
          t(
            "Offers no intervention or offers one unrelated to both the topic and the broader subject.",
            "Não apresenta proposta, ou a proposta não se relaciona ao tema nem ao assunto.",
          ),
          { points: 0 },
        ),
        handbookRule(
          t(
            "Offers a vague or weak intervention with one valid element or none.",
            "Proposta vaga ou precária, com um elemento válido ou nenhum.",
          ),
          { points: 40 },
        ),
        manualRule(
          t(
            "Offers an insufficient intervention with two valid elements.",
            "Proposta insuficiente, com dois elementos válidos.",
          ),
          { count: 2, points: 80 },
        ),
        manualRule(
          t(
            "Offers a moderately developed intervention with three valid elements.",
            "Proposta mediana, com três elementos válidos.",
          ),
          { count: 3, points: 120 },
        ),
        manualRule(
          t(
            "Offers a well-developed intervention with four valid elements.",
            "Proposta bem elaborada, com quatro elementos válidos.",
          ),
          { count: 4, points: 160 },
        ),
        manualRule(
          t(
            "Offers a detailed, very well-developed intervention with all five valid elements.",
            "Proposta muito bem elaborada e detalhada, com os cinco elementos válidos.",
          ),
          { count: 5, points: 200 },
        ),
      ],
      id: "c5",
      parts: [
        manualRule(t("Action. What should be done.", "Ação: o que deve ser feito."), {
          id: "action",
        }),
        manualRule(
          t(
            "Actor. The institution, group, or person who carries out the action.",
            "Agente: quem executa a ação (uma instituição, um grupo ou uma pessoa).",
          ),
          { id: "agent" },
        ),
        manualRule(
          t(
            "Means. How the action is carried out.",
            "Modo ou meio: como, ou por meio de que, a ação é feita.",
          ),
          { id: "means" },
        ),
        manualRule(
          t(
            "Effect. The action’s purpose or intended result.",
            "Efeito: para que a ação é feita, sua finalidade ou resultado esperado.",
          ),
          { id: "effect" },
        ),
        manualRule(
          t(
            "Detail. An explanation, example, or specification about another element.",
            "Detalhamento: informação a mais sobre um dos outros elementos (explicação, exemplo ou especificação).",
          ),
          { id: "detail" },
        ),
      ],
      points: 200,
    },
  );
}

export const essayTotal = t(
  "Add the five competency marks. The final score averages the two graders’ scores.",
  "A nota é a soma das cinco competências; a nota final é a média das notas dos dois avaliadores.",
);

export function buildEnemGrading({
  handbook,
  manual,
  notice,
}: {
  handbook: string;
  manual: string;
  notice: string;
}) {
  const handbookRule = cited(handbook);
  const manualRule = cited(manual);

  return {
    combination: cited(notice)(essayTotal, { method: "sum" as const, step: 20 }),
    conventions: [
      manualRule(
        t(
          "Productive background knowledge is a legitimate reference from a field of knowledge (a law, statistic, thinker, historical event, or work) that is relevant to the topic and used in the argument. A passing, vague, or common-sense reference is insufficient.",
          "Repertório produtivo é uma referência legítima de uma área do conhecimento (lei, dado, pensador, fato histórico, obra), pertinente ao tema e usada no argumento; repertório só citado, vago ou de senso comum não é produtivo.",
        ),
      ),
      manualRule(
        t(
          "A generic actor (“someone,” “everyone”) or an empty action (“measures should be taken”) earns no credit as an element of the intervention.",
          "Na proposta de intervenção, um agente genérico (“alguém”, “todos”) e uma ação sem conteúdo (“medidas devem ser tomadas”) não contam como elementos válidos.",
        ),
      ),
      handbookRule(
        t(
          "The exam board’s example for a prompt about valuing African heritage in Brazil treats discussing African heritage without discussing how it is valued as partial coverage. Addressing history or prejudice in Brazil without discussing African heritage is off topic.",
          "Exemplo da banca: num tema sobre valorizar a herança africana no Brasil, tratar da herança africana sem falar da sua valorização foi tangenciamento; tratar da história ou do preconceito no Brasil sem a herança africana foi fuga ao tema.",
        ),
      ),
    ],
    criteria: [
      ...handbookCriteria.map(({ awards, id, text }) =>
        handbookRule(text, {
          awards: awards.map((description, level) =>
            handbookRule(description, { points: level * 40 }),
          ),
          id,
          points: 200,
        }),
      ),
      interventionCriterion({ handbookRule, manualRule }),
    ],
    language: null,
    limits: [
      manualRule(
        t(
          "A conditional intervention (“if X were done, Y would improve”) earns at most 80 points.",
          "Proposta condicional (“se X fosse feito, Y melhoraria”): no máximo 80 pontos.",
        ),
        { criteria: ["c5"], max: 80 },
      ),
      handbookRule(
        t(
          "Partial coverage means discussing only the broader subject without addressing the specific topic. Competencies 2, 3, and 5 each earn at most 40 points.",
          "Tangenciamento ao tema: o texto trata o tema de forma parcial, só pelo assunto mais amplo a que ele se liga, sem discutir o tema específico; no máximo 40 pontos nas competências 2, 3 e 5.",
        ),
        { criteria: ["c2", "c3", "c5"], max: 40 },
      ),
      manualRule(
        t(
          "An intervention copied from the prompt, unrelated to the topic and broader subject, or in violation of human rights earns zero for this competency.",
          "Proposta copiada da proposta de redação, sem relação com o tema e o assunto, ou que desrespeita os direitos humanos: zero na competência.",
        ),
        { criteria: ["c5"], max: 0 },
      ),
    ],
    rounding: null,
    zeroing: [
      handbookRule(
        t(
          "The essay develops neither the assigned topic nor the broader subject it belongs to.",
          "Fuga total ao tema: o texto não desenvolve nem o tema específico proposto nem o assunto mais amplo a que ele se liga.",
        ),
        { kinds: ["offTopic" as const] },
      ),
      handbookRule(
        t(
          "The text does not follow the argumentative essay form.",
          "Não obediência ao tipo dissertativo-argumentativo.",
        ),
        { kinds: ["wrongForm" as const] },
      ),
      handbookRule(
        t(
          "A text of seven written lines or fewer is too short.",
          "Texto com até 7 linhas escritas, considerado insuficiente.",
        ),
        { kinds: ["tooFewLines" as const], maxLines: 7 },
      ),
      handbookRule(
        t(
          "The answer copies the source texts or exam questions and includes fewer than eight lines of original writing.",
          "Cópia dos textos motivadores ou das questões da prova, sem ao menos 8 linhas de produção própria.",
        ),
        { kinds: ["copiedSupport" as const], maxLines: 7 },
      ),
      handbookRule(t("The answer sheet is blank.", "Folha de redação em branco."), {
        kinds: ["blank" as const],
      }),
      handbookRule(
        t(
          "A name, signature, initials, or other identifying mark appears outside the designated area.",
          "Nome, assinatura, rubrica ou outra identificação fora do local indicado.",
        ),
        { kinds: ["identification" as const] },
      ),
    ],
  };
}
