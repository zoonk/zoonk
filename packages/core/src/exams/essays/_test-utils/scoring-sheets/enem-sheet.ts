import { type WritingSheet } from "../../../../library/exams/written-grading";
import { from } from "./cite";

const cartilha = from("enem-cartilha");
const manual = from("enem-correction-manuals");

const BAND_STEP = 40;

function enemBands(texts: readonly [string, string, string, string, string, string]) {
  return texts.map((text, level) => cartilha(text, { points: level * BAND_STEP }));
}

export const ENEM_GRADING: WritingSheet = {
  combination: from("enem-notice")(
    "A nota é a soma das cinco competências; a nota final é a média das notas dos dois avaliadores.",
    { method: "sum" as const, step: 20 },
  ),
  conventions: [
    manual(
      "Repertório produtivo é uma referência legítima de uma área do conhecimento (lei, dado, pensador, fato histórico, obra), pertinente ao tema e usada no argumento; repertório só citado, vago ou de senso comum não é produtivo.",
    ),
    manual(
      "Na proposta de intervenção, um agente genérico (“alguém”, “todos”) e uma ação sem conteúdo (“medidas devem ser tomadas”) não contam como elementos válidos.",
    ),
    manual(
      "Tratar só do assunto amplo é tangenciamento, não fuga ao tema: a nota zero cabe ao texto que ignora o tema e o assunto.",
    ),
  ],
  criteria: [
    cartilha("Domínio da modalidade escrita formal da língua portuguesa", {
      awards: enemBands([
        "Desconhece a modalidade escrita formal.",
        "Domínio precário, com desvios diversificados e frequentes em todo o texto.",
        "Domínio insuficiente, com muitos desvios de gramática, de escolha de registro e de convenções da escrita.",
        "Domínio mediano, com alguns desvios ou períodos truncados.",
        "Bom domínio, com poucos desvios.",
        "Excelente domínio: desvios só como exceção, quando não se repetem.",
      ]),
      id: "c1",
      points: 200,
    }),
    cartilha(
      "Compreensão da proposta e uso de conceitos de várias áreas para desenvolver o tema, no texto dissertativo-argumentativo",
      {
        awards: enemBands([
          "Foge ao tema ou não atende ao tipo dissertativo-argumentativo.",
          "Tangencia o tema ou tem traços constantes de outros tipos textuais.",
          "Copia trechos dos textos motivadores ou não tem proposição, argumentação e conclusão claras.",
          "Argumentação previsível e domínio mediano do tipo textual.",
          "Argumentação consistente e bom domínio do tipo textual, com proposição, argumentação e conclusão.",
          "Argumentação consistente, com repertório sociocultural produtivo, e excelente domínio do tipo textual.",
        ]),
        id: "c2",
        points: 200,
      },
    ),
    cartilha(
      "Seleção, relação, organização e interpretação de informações, fatos, opiniões e argumentos em defesa de um ponto de vista",
      {
        awards: enemBands([
          "Informações não relacionadas ao tema e sem defesa de um ponto de vista.",
          "Informações pouco relacionadas ao tema ou incoerentes, sem defesa de um ponto de vista.",
          "Informações desorganizadas ou contraditórias, limitadas aos textos motivadores.",
          "Informações limitadas aos argumentos dos textos motivadores e pouco organizadas.",
          "Informações organizadas, com indícios de autoria.",
          "Informações consistentes e organizadas, configurando autoria.",
        ]),
        id: "c3",
        points: 200,
      },
    ),
    cartilha("Mecanismos linguísticos necessários para a construção da argumentação", {
      awards: enemBands([
        "Não articula as informações.",
        "Articula as partes do texto de forma precária.",
        "Articulação insuficiente, com muitas inadequações e repertório limitado de recursos coesivos.",
        "Articulação mediana, com inadequações e repertório pouco diversificado de recursos coesivos.",
        "Articula as partes com poucas inadequações e repertório diversificado de recursos coesivos.",
        "Articula bem as partes do texto, com repertório diversificado de recursos coesivos.",
      ]),
      id: "c4",
      points: 200,
    }),
    cartilha("Proposta de intervenção para o problema abordado, respeitando os direitos humanos", {
      awards: [
        cartilha("Não apresenta proposta, ou a proposta não se relaciona ao tema nem ao assunto.", {
          points: 0,
        }),
        cartilha("Proposta vaga ou precária, com um elemento válido ou nenhum.", { points: 40 }),
        manual("Proposta insuficiente, com dois elementos válidos.", { count: 2, points: 80 }),
        manual("Proposta mediana, com três elementos válidos.", { count: 3, points: 120 }),
        manual("Proposta bem elaborada, com quatro elementos válidos.", { count: 4, points: 160 }),
        manual("Proposta muito bem elaborada e detalhada, com os cinco elementos válidos.", {
          count: 5,
          points: 200,
        }),
      ],
      id: "c5",
      parts: [
        manual("Ação: o que deve ser feito.", { id: "action" }),
        manual("Agente: quem executa a ação (uma instituição, um grupo ou uma pessoa).", {
          id: "agent",
        }),
        manual("Modo ou meio: como, ou por meio de que, a ação é feita.", { id: "means" }),
        manual("Efeito: para que a ação é feita, sua finalidade ou resultado esperado.", {
          id: "effect",
        }),
        manual(
          "Detalhamento: informação a mais sobre um dos outros elementos (explicação, exemplo ou especificação).",
          { id: "detail" },
        ),
      ],
      points: 200,
    }),
  ],
  language: null,
  limits: [
    manual("Proposta condicional (“se X fosse feito, Y melhoraria”): no máximo 80 pontos.", {
      criteria: ["c5"],
      max: 80,
    }),
    manual(
      "Tangenciamento: o texto ou a proposta trata só do assunto amplo, e não do tema; no máximo 40 pontos em cada uma dessas competências.",
      { criteria: ["c2", "c3", "c5"], max: 40 },
    ),
    manual(
      "Proposta copiada da proposta de redação, sem relação com o tema e o assunto, ou que desrespeita os direitos humanos: zero na competência.",
      { criteria: ["c5"], max: 0 },
    ),
  ],
  rounding: null,
  zeroing: [
    cartilha("Fuga total ao tema.", { kinds: ["offTopic" as const] }),
    cartilha("Não obediência ao tipo dissertativo-argumentativo.", {
      kinds: ["wrongForm" as const],
    }),
    cartilha("Texto com até 7 linhas escritas, considerado insuficiente.", {
      kinds: ["tooFewLines" as const],
      maxLines: 7,
    }),
    cartilha(
      "Cópia dos textos motivadores ou das questões da prova, sem ao menos 8 linhas de produção própria.",
      { kinds: ["copiedSupport" as const], maxLines: 7 },
    ),
    cartilha("Folha de redação em branco.", { kinds: ["blank" as const] }),
    cartilha("Nome, assinatura, rubrica ou outra identificação fora do local indicado.", {
      kinds: ["identification" as const],
    }),
  ],
};
