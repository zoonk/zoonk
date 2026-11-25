import { FGV_ANSWERS } from "./fgv-answers";
import { type WritingCase, type ZeroKind, publishedCase, publishedQuestion } from "./shared";

const ARCHIVE =
  "https://www.provadaordem.com.br/blog/post/2a-fase-oab-provas-e-depoimentos-dos-aprovados/";

const LABOR15_ARCHIVE = `${ARCHIVE}#:~:text=Nota%209%2C9`;
const CIVIL16_ARCHIVE = `${ARCHIVE}#:~:text=Nota%207%2C6`;
const PENAL16_ARCHIVE = `${ARCHIVE}#:~:text=Nota%206%2C35`;
const TAX16_ARCHIVE = `${ARCHIVE}#:~:text=Nota%206%2C4`;

const NOTICE_15 =
  "https://oab.fgv.br/arq/513/20140929025803-Edital%20do%20XV%20Exame%20de%20Ordem%20Unificado.pdf";

const NOTICE_16 =
  "https://oab.fgv.br/arq/615/23012015140144_Edital%20do%20XVI%20Exame%20de%20Ordem%20Unificado_15_01_23%20%281%29.pdf";

type Question = Pick<
  Parameters<typeof publishedQuestion>[0],
  "question" | "sections" | "text" | "title"
> & { number: number; earned: number[]; officialTotal: number };

function oabCases({
  task,
  notice,
  reference,
  sectionTotal,
  standard,
  questions,
}: {
  task: string;
  notice: string;
  reference: string;
  sectionTotal: number;
  standard: string;
  questions: Question[];
}) {
  const noticeCitation = { passage: "Edital, §§ 3.5, 4.2.4.1–4.2.6", sourceId: notice };

  const zeroing: { citation: typeof noticeCitation; kinds: ZeroKind[]; text: string }[] = [
    { citation: noticeCitation, kinds: ["blank"], text: "No answer is written." },
    {
      citation: noticeCitation,
      kinds: ["offTopic"],
      text: "The answer as a whole does not address the situation or the content assessed.",
    },
    {
      citation: noticeCitation,
      kinds: ["identification"],
      text: "The response contains a mark or signature that identifies the examinee.",
    },
    ...(notice === NOTICE_16
      ? [
          {
            citation: noticeCitation,
            kinds: ["wrongForm" as const],
            text: "The written response fails to identify which lettered item it answers.",
          },
        ]
      : []),
  ];

  return questions.map(({ number, question, sections, text, title, earned, officialTotal }) => {
    const id = `fgv-oab-${task}-q${number}`;

    const input = publishedQuestion({
      citation: { passage: `Questão ${number}, Distribuição dos Pontos`, sourceId: standard },
      kind: "oab",
      lines: 30,
      question,
      sections,
      taskKey: id,
      text,
      title,
    });

    return publishedCase({
      expected: {
        earned,
        officialTotal,
        passBoundary: {
          otherAnswers: Number((sectionTotal - officialTotal).toFixed(2)),
          sectionMinimum: 6,
        },
      },
      id,
      source: {
        author: "Candidate",
        board: "FGV/OAB",
        notice,
        reference,
        scoreReference: reference,
      },
      userInput: {
        ...input,
        arithmetic: { rounding: null },
        basis: {
          ...input.basis,
          grading: { ...input.basis.grading, zeroing },
          minimumWords: 0,
          partMinimum: { max: 10, minimum: { unit: "points", value: 6 } },
        },
      },
    });
  });
}

// Each section is an FGV item. The atoms preserve its separately scored theses,
// reasons and authorities. Credit a citation only in support of the answer it
// belongs to. Independent atoms can also sum to scores outside FGV's item bands.
export const FGV_PUBLISHED_CASES: WritingCase[] = [
  ...oabCases({
    notice: NOTICE_15,
    questions: [
      {
        earned: [0, 1, 2, 3],
        number: 1,
        officialTotal: 1.25,
        question: `O sindicato dos empregados nas usinas de açúcar de Linhares (ES) entabulou convenção coletiva contemplando diversos direitos para os trabalhadores, dentre os quais a entrega de uma cesta básica mensal. Porém, logo após, iniciou-se divergência sobre a quantidade e a qualidade dos produtos que deveriam integrar a referida cesta básica, tendo o sindicato dos empregados decidido ajuizar ação na Justiça do Trabalho.

Diante desse quadro, responda aos itens a seguir.

A) De acordo com a lei, é necessário, ou não, comum acordo para que seja instaurado dissídio coletivo de natureza jurídica? (Valor: 0,85)

B) De acordo com a lei, qual é o prazo máximo de vigência de uma sentença normativa? Apresente fundamento legal que justifique sua resposta. (Valor: 0,40)

O examinando deve fundamentar suas respostas. A mera citação do dispositivo legal não confere pontuação.`,
        sections: [
          {
            aspects: [
              [
                "No mutual agreement is required for a collective dispute of a legal rather than economic nature.",
                0.75,
              ],
              ["Supports the mutual-agreement conclusion with Constitution Art. 114, § 2º.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              ["A normative judgment lasts at most four years.", 0.3],
              [
                "Supports the four-year limit with CLT Art. 868, sole paragraph, or TST SDC PN 120.",
                0.1,
              ],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.labor15[1],
        title: "Dissídio coletivo e sentença normativa",
      },
      {
        earned: [0, 1, 2, 3, 4],
        number: 2,
        officialTotal: 1.25,
        question: `Pedro e Paulo ajuizaram uma reclamação trabalhista cada. Ambas idênticas, sob o mesmo patrocínio e com pedido de antecipação de tutela para reintegração. Pedro obteve êxito na concessão da antecipação de tutela liminarmente, antes da audiência de instrução. Paulo só teve o pedido de antecipação de tutela deferido na sentença.

A) Na qualidade de advogado da empresa, qual a medida judicial a ser utilizada para reverter os efeitos da tutela deferida a Pedro? (Valor: 0,60)

B) Na qualidade de advogado da empresa, que medidas judiciais deverão ser adotadas para suspender e reverter os efeitos da tutela deferida a Paulo? (Valor: 0,65)

O examinando deve fundamentar suas respostas. A mera citação do dispositivo legal não confere pontuação.`,
        sections: [
          {
            aspects: [
              [
                "Identifies mandado de segurança against the interlocutory injunction granted to Pedro.",
                0.5,
              ],
              [
                "Supports Pedro’s remedy with TST Súmula 414 II, CLT Art. 893 § 1º, or Law 12.016/09 Art. 5 II.",
                0.1,
              ],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              ["Files a recurso ordinário against the final judgment granting Paulo relief.", 0.35],
              ["Seeks an ação cautelar to give the appeal suspensive effect.", 0.2],
              ["Supports the procedural remedies with TST Súmula 414 I.", 0.1],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.labor15[2],
        title: "Tutela antecipada em reclamação trabalhista",
      },
      {
        earned: [0, 1, 2, 3],
        number: 3,
        officialTotal: 1.25,
        question: `Raquel Infante nasceu em 5 de maio de 1995 e foi admitida na empresa Asa Branca Refinaria S/A em 13 de maio de 2011, lá permanecendo por 4 meses, sendo dispensada em 13 de setembro de 2011. Em razão de direitos a que entende fazer jus e que não foram pagos, Raquel ajuizou reclamação trabalhista em 20 de dezembro de 2013. Em contestação, a empresa suscitou prescrição total (extintiva), pois a ação teria sido ajuizada mais de 2 anos após o rompimento do contrato.

A respeito do caso apresentado, responda, fundamentadamente, aos itens a seguir.

A) Analise se ocorreu prescrição total (extintiva) na hipótese, justificando. (Valor: 0,65)

B) Analise se Raquel poderia ser designada para trabalhar em jornada noturna, justificando. (Valor: 0,60)

O examinando deve fundamentar suas respostas. A mera citação do dispositivo legal não confere pontuação.`,
        sections: [
          {
            aspects: [
              [
                "No total limitations bar because time began running at 18 or does not run against minors under 18.",
                0.55,
              ],
              ["Supports the limitations conclusion with CLT Art. 440.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              [
                "Raquel could not work nights because the law prohibits night work for minors under 18.",
                0.5,
              ],
              [
                "Supports the prohibition with Constitution Art. 7 XXXIII, CLT Art. 404, or ECA Art. 67 I.",
                0.1,
              ],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.labor15[3],
        title: "Prescrição e trabalho noturno do menor",
      },
      {
        earned: [0, 1, 2, 3, 4],
        number: 4,
        officialTotal: 1.25,
        question: `Determinado empregado ajuizou ação trabalhista em face de seu empregador (empresa de serviço fornecedora de mão de obra na área de limpeza), logo após haver sido dispensado. Na ação aduziu que era detentor de estabilidade decorrente de doença acidentária, supostamente causada pelo trabalho. Para tanto, juntou aos autos carta de concessão de benefício previdenciário por doença comum, não produzindo qualquer outra prova. A empregadora ré apenas negou que a doença era decorrente do trabalho desempenhado.

Sobre o caso apresentado, utilizando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso, responda aos itens a seguir.

A) Indique, sob o aspecto da distribuição do ônus da prova, a quem caberia comprovar se a doença do empregado decorre ou não do trabalho. (Valor: 0,65)

B) Qual o outro meio de prova passível de utilização no caso em tela? (Valor: 0,60)

O examinando deve fundamentar suas respostas. A mera citação do dispositivo legal não confere pontuação.`,
        sections: [
          {
            aspects: [
              ["The employee as claimant bears the burden of proof.", 0.35],
              [
                "The occupational link is a fact giving rise to the right or alleged by the claimant.",
                0.2,
              ],
              ["Supports the burden with CPC Art. 333 I or CLT Art. 818.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              ["Identifies expert evidence to prove the occupational link.", 0.5],
              [
                "Supports expert evidence with CPC Art. 145 or 420, Law 8.213/91 Art. 21-A, or TST Súmula 378 II.",
                0.1,
              ],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.labor15[4],
        title: "Ônus da prova e doença ocupacional",
      },
    ],
    reference: LABOR15_ARCHIVE,
    sectionTotal: 9.9,
    standard: "https://oab.fgv.br/arq/513/03022015170910_Trabalho.pdf",
    task: "xv-labor",
  }),
  ...oabCases({
    notice: NOTICE_16,
    questions: [
      {
        earned: [0, 1, 2, 3, 4, 5, 6, 7],
        number: 1,
        officialTotal: 1.25,
        question: `Após o período de relacionamento amoroso de dois anos, Mário Alberto, jovem com 17 anos de idade, e Cristina, com apenas 15 anos, decidem casar. A mãe de Mário, que detém a sua guarda, autoriza o casamento, apesar da discordância de seu pai. Já os pais de Cristina consentem com o casamento.

Com base na situação apresentada, responda aos itens a seguir.

A) É possível o casamento entre Mário Alberto e Cristina? (Valor: 0,60)

B) Caso os jovens se casem, quais os efeitos desse casamento? Há alguma providência judicial ou extrajudicial a ser tomada pelos jovens? (Valor: 0,65)

Responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              ["Cristina is below the marriageable age despite parental consent.", 0.2],
              ["Supports Cristina’s lack of marriage capacity with Civil Code Art. 1.517.", 0.1],
              ["Mário needs both parents’ consent or a judicial override of the refusal.", 0.2],
              ["Supports the judicial override with Civil Code Art. 1.519.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              [
                "The marriage is voidable because Cristina is underage, Mário lacks consent, or both.",
                0.25,
              ],
              ["Supports voidability with Civil Code Art. 1.550 I and II.", 0.1],
              ["Proposes a judicial annulment action or confirmation of the marriage.", 0.2],
              [
                "Supports annulment with Civil Code Art. 1.555 or confirmation with Art. 1.553, matching the remedy proposed.",
                0.1,
              ],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.civil16[1],
        title: "Capacidade matrimonial e anulação",
      },
      {
        earned: [0, 1, 2, 3, 4, 5],
        number: 2,
        officialTotal: 1.25,
        question: `A famosa entrevistadora Emília Juris anunciou, em seu programa, estar grávida de uma menina. Contudo, na semana seguinte, seu marido afirmou que não podia ter filhos, comprovando, por laudo médico de infertilidade, sua afirmativa. Em rede nacional, acusou-a de adultério.

Diante da notícia avassaladora, Etanael Castro publicou texto no seu blog ofendendo Emília com palavrões e expressões chulas, principalmente no âmbito sexual, atingindo-a intensamente em sua honra, e, em relação à futura filha da entrevistadora, usou os mesmos termos, até de forma mais grosseira.

Emília procura um advogado para assisti-la na defesa de seus direitos, questionando-o, inclusive, quanto aos direitos de sua filha que já foi ofendida mesmo antes de nascer.

Diante da situação narrada, responda aos itens a seguir, fundamentando-as com os dispositivos pertinentes.

A) Mesmo antes da criança nascer, Emília pode reclamar direitos do nascituro? (Valor: 0,45)

B) Emília possui legitimidade para ajuizar ação em seu nome e do nascituro? (Valor: 0,80)

Obs.: responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              ["The law protects the unborn child’s rights from conception.", 0.35],
              ["Supports the protection with Civil Code Art. 2.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              ["Emília has ordinary standing to assert her own rights.", 0.2],
              ["Emília has standing to act for the unborn child’s rights.", 0.2],
              ["Emília acts as procedural representative in the child’s name and interest.", 0.3],
              ["Supports standing or representation with CPC Art. 6 or 8.", 0.1],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.civil16[2],
        title: "Direitos e representação do nascituro",
      },
      {
        earned: [0, 1, 4, 5],
        number: 3,
        officialTotal: 0.85,
        question: `Roberval não possuía filhos e seus pais já eram falecidos. Seu único parente era seu irmão Ângelo, sendo certo que tanto Roberval quanto Ângelo jamais se casaram ou viveram em união estável. Roberval, que tinha um imóvel na Tijuca e outro menor no Flamengo, decidiu beneficiar Caio, seu melhor amigo, em sua sucessão, razão pela qual estabeleceu em seu testamento que, por ocasião de sua morte, o imóvel da Tijuca deveria ser destinado a Caio, passando para os filhos de Caio quando do falecimento deste. Quando Roberval faleceu, Caio já tinha um filho de 05 anos.

Com base no enunciado acima, responda aos itens a seguir.

A) Roberval poderia beneficiar seu amigo Caio em sua sucessão? (Valor: 0,45)

B) Descreva a sucessão de Roberval e como deverá ser dividida a sua herança, consistente nos seus dois imóveis, a saber, o da Tijuca e o do Flamengo. (Valor: 0,80)

Responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              [
                "With no necessary heirs, Roberval could benefit Caio without a limit on the amount.",
                0.35,
              ],
              ["Supports freedom of disposition with Civil Code Arts. 1.845 and 1.850.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              [
                "Caio’s child receives bare ownership of the Tijuca property and Caio receives the usufruct.",
                0.3,
              ],
              ["Supports that split with Civil Code Art. 1.952, sole paragraph.", 0.1],
              ["Roberval’s brother Ângelo inherits the Flamengo property.", 0.3],
              ["Supports Ângelo’s inheritance with Civil Code Art. 1.829 IV.", 0.1],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.civil16[3],
        title: "Testamento, substituição e sucessão legítima",
      },
      {
        // FGV gave item B 0.45. The scan cites both parts of Art. 1.379 and omits the outward works.
        earned: [0, 1, 2, 3, 5],
        number: 4,
        officialTotal: 1.05,
        question: `João e Maurício são proprietários e moradores de imóveis vizinhos, situados na Cidade do Rio de Janeiro. Embora o seu imóvel disponha de acesso próprio à via pública, há mais de vinte anos João atravessa diariamente o terreno de Maurício para chegar ao ponto de ônibus mais próximo da sua moradia, pois esse é o trajeto mais curto existente. Ademais, o caminho utilizado por João é pavimentado e conta com sistema de drenagem para as águas pluviais. Além disso, na cerca que separa os dois imóveis, há uma porteira, de onde tem início o caminho.

Determinado dia, Maurício decide impedir João de continuar a atravessar o seu terreno. Com esse intuito, instala uma grade no lugar da porteira existente na cerca que separa os dois imóveis. Inconformado, João decide consultar um advogado.

Na condição de advogado(a) consultado(a) por João, responda aos itens a seguir.

A) Tem João direito a constranger Maurício a lhe dar passagem forçada, de modo a continuar a usar o caminho existente no terreno de Maurício? (Valor: 0,60)

B) Independentemente da resposta ao item anterior, pode João ingressar em juízo para que seja reconhecida a aquisição de direito real de servidão de passagem, por meio de usucapião? (Valor: 0,65)

Responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              [
                "João already has public-road access, so he has no right to a compulsory passage.",
                0.5,
              ],
              ["Supports the denial with Civil Code Art. 1.285.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              [
                "Identifies a right-of-way serving João’s property and burdening Maurício’s property.",
                0.25,
              ],
              [
                "Supports acquisition of the easement by adverse possession with Civil Code Art. 1.379.",
                0.1,
              ],
              [
                "Identifies outward works showing an apparent easement and 20 years of continuous and uncontested exercise.",
                0.2,
              ],
              ["Supports the 20-year period with Civil Code Art. 1.379, sole paragraph.", 0.1],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.civil16[4],
        title: "Passagem forçada e servidão de trânsito",
      },
    ],
    reference: CIVIL16_ARCHIVE,
    sectionTotal: 7.6,
    standard: "https://oab.fgv.br/arq/615/08062015172607_Civil.pdf",
    task: "xvi-civil",
  }),
  ...oabCases({
    notice: NOTICE_16,
    questions: [
      {
        earned: [0, 1, 3],
        number: 1,
        officialTotal: 0.8,
        question: `Carlos foi condenado pelos crimes de tráfico de entorpecentes e posse de arma de fogo de uso permitido, em concurso material, sendo sua conduta tipificada da seguinte forma: Art. 33 da Lei nº 11.343/06 e Art. 12 da Lei nº 10.826/03, na forma do Art. 69 do Código Penal. A pena ficou estabelecida em 05 anos de reclusão em regime fechado para o crime de tráfico e 01 ano de detenção em regime semiaberto pelo crime de posse de arma de fogo. Apenas a defesa técnica apelou, requerendo a mudança do regime de pena aplicado para o crime do Art. 33 da Lei nº 11.343/06, tendo o feito transitado em julgado para a acusação. O recurso foi desprovido. Todavia, de ofício, sem reflexo no quantum, que permaneceu em 06 anos de pena privativa de liberdade, o Tribunal reclassificou o fato para o Art. 33 c/c o Art. 40, IV, da Lei nº 11343/06, afastando o crime autônomo da lei de armas e aplicando a causa de aumento respectiva.

Considerando as informações narradas na hipótese, responda aos itens a seguir.

A) Poderia ser aplicado regime inicial de cumprimento da pena diverso do fechado para o crime de tráfico ilícito de entorpecentes, previsto no Art. 33, caput, da Lei nº 11.343/06? (Valor: 0,60)

B) Poderia o Tribunal de Justiça em sede de recurso da defesa realizar a reclassificação adotada? (Valor: 0,65)

Responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              [
                "The Supreme Court held the mandatory closed initial prison regime unconstitutional for heinous and equivalent offenses.",
                0.35,
              ],
              ["Identifies the invalidated requirement in Law 8.072/90 Art. 2 § 1º.", 0.1],
              ["Identifies violation of the principle of individualization of punishment.", 0.15],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              [
                "Combining the convictions on a defense-only appeal would violate the prohibition on reformatio in pejus.",
                0.35,
              ],
              [
                "Explains how combining convictions actually worsens the prison regime, limitations, or execution of the sentence.",
                0.3,
              ],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.penal16[1],
        title: "Regime inicial e reformatio in pejus",
      },
      {
        earned: [0, 2, 3, 4],
        number: 3,
        officialTotal: 1.05,
        question: `Em uma discussão de futebol, Rubens e Enrico, em comunhão de ações e desígnios, chamaram Eduardo de “ladrão” e “estelionatário”, razão pela qual Eduardo formulou uma queixa-crime em face de ambos.

No curso da ação penal, porém, Rubens procurou Eduardo para pedir desculpas pelos seus atos, razão pela qual Eduardo expressamente concedeu perdão do ofendido em seu favor, sendo esse prontamente aceito e, consequentemente, extinta a punibilidade de Rubens. Eduardo, contudo, se recusou a conceder o perdão para Enrico, pois disse que não era a primeira vez que o querelado tinha esse tipo de atitude.

Considerando apenas as informações narradas, responda aos itens a seguir.

A) Qual o crime praticado, em tese, por Rubens e Enrico? (Valor: 0,60)

B) Que argumento poderá ser formulado pelo advogado de Enrico para evitar sua punição? (Valor: 0,65)

Responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              ["Classifies the crime as injúria.", 0.3],
              [
                "Explains that the speakers ascribed a negative quality without alleging a specific criminal act.",
                0.2,
              ],
              ["Provides Penal Code Art. 140 as the basis for the classification.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              ["Forgiveness of one defendant benefits all defendants who accept it.", 0.55],
              ["Supports extension of forgiveness with CPP Art. 51 or Penal Code Art. 106 I.", 0.1],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.penal16[3],
        title: "Injúria e extensão do perdão",
      },
      {
        earned: [0, 1],
        number: 4,
        officialTotal: 0.5,
        question: `Wesley, estudante, foi preso em flagrante no dia 03 de março de 2015 porque conduzia um veículo automotor que sabia ser produto de crime pretérito registrado em Delegacia da área em que residia. Na data dos fatos, Wesley tinha 20 anos, era primário, mas existia um processo criminal em curso em seu desfavor, pela suposta prática de um crime de furto qualificado. Diante dessa anotação em sua Folha de Antecedentes Criminais, a autoridade policial representou pela conversão da prisão em flagrante em preventiva, afirmando que existiria risco concreto para a ordem pública, pois o indiciado possuía outros envolvimentos com o aparato judicial. Você, como advogado(a) indicado por Wesley, é comunicado da ocorrência da prisão em flagrante, além de tomar conhecimento da representação formulada pelo Delegado. Da mesma forma, o comunicado de prisão já foi encaminhado para o Ministério Público e para o magistrado, sendo todas as legalidades da prisão em flagrante observadas.

Considerando as informações narradas, responda aos itens a seguir.

A) Qual a medida processual, diferente de habeas corpus, a ser adotada pela defesa técnica de Wesley? (Valor: 0,50)

B) A representação da autoridade policial foi elaborada de modo adequado? (Valor: 0,75)

Responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              ["Seeks provisional release on behalf of Wesley.", 0.4],
              ["Supports provisional release with CPP Art. 321 or 310 III.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              [
                "The police request was inadequate because Wesley’s case fails the requirements for preventive detention, including the applicable offense and offender eligibility requirements.",
                0.65,
              ],
              ["Supports that conclusion with CPP Art. 313.", 0.1],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.penal16[4],
        title: "Liberdade provisória e prisão preventiva",
      },
    ],
    reference: PENAL16_ARCHIVE,
    sectionTotal: 6.35,
    standard: "https://oab.fgv.br/arq/615/08062015172449_Penal.pdf",
    task: "xvi-penal",
  }),
  ...oabCases({
    notice: NOTICE_16,
    questions: [
      {
        earned: [0, 1, 4, 5],
        number: 1,
        officialTotal: 0.85,
        question: `O Município XYZ resolveu instituir, por meio de lei específica, um tributo que tem como fato gerador a valorização imobiliária decorrente de obra realizada pelo Estado Alfa em seu território, sendo o contribuinte o proprietário do imóvel valorizado e a base de cálculo, independentemente da valorização experimentada por cada imóvel, o custo da obra estatal.

Sobre a hipótese descrita, responda aos itens a seguir.

A) Qual seria a espécie tributária que o Município XYZ pretendeu instituir? Aponte o dispositivo constitucional aplicável. (Valor: 0,45)

B) Na hipótese descrita, o Município XYZ é competente para instituir tal tributo? (Valor: 0,40)

C) A base de cálculo do tributo está correta? (Valor: 0,40)

Obs.: responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              ["Identifies the levy as contribuição de melhoria.", 0.35],
              ["Supports classification with Constitution Art. 145 III.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              [
                "Only the public entity that undertook the works can impose the levy, so the municipality cannot.",
                0.3,
              ],
              [
                "Supports that allocation of power with Constitution Art. 145 III or Decree-Law 195/67 Art. 3.",
                0.1,
              ],
            ],
            id: "b",
            name: "Item B",
          },
          {
            aspects: [
              [
                "The basis is the actual increase in property value, with the cost of the works an overall cap.",
                0.3,
              ],
              ["Supports the calculation with CTN Art. 81 or Decree-Law 195/67 Art. 3.", 0.1],
            ],
            id: "c",
            name: "Item C",
          },
        ],
        text: FGV_ANSWERS.tax16[1],
        title: "Competência e base de cálculo da contribuição de melhoria",
      },
      {
        earned: [0, 1],
        number: 2,
        officialTotal: 0.65,
        question: `Em 2008, constou na Declaração de Débitos e Créditos Tributários Federais (DCTF) da pessoa jurídica AB&C Participações Ltda. que era devido, a título de Contribuição para o Financiamento da Seguridade Social – COFINS, o valor de R$ 25.000,00 (vinte e cinco mil reais). No entanto, a AB&C Participações Ltda. não efetuou o recolhimento antes do vencimento do tributo.

Em 2009, antes do início de qualquer fiscalização por parte da Fazenda Nacional, a AB&C Participações Ltda. efetuou o recolhimento daquele montante da COFINS informado no ano anterior na DCTF, sem, no entanto, o acréscimo da multa de mora, em razão da ocorrência da denúncia espontânea. Por não concordar com a AB&C Participações Ltda., a Fazenda Nacional lavrou auto de infração cobrando o valor integral do tributo (deduzido do montante já recolhido), sendo a AB&C Participações Ltda. intimada para pagar ou apresentar defesa.

Sobre o caso, responda aos itens a seguir.

A) Está correto o entendimento da pessoa jurídica AB&C Participações Ltda. sobre a ocorrência da denúncia espontânea? (Valor: 0,65)

B) Caso a pessoa jurídica proponha ação anulatória buscando desconstituir o auto de infração, poderá apresentar, simultaneamente, defesa no processo administrativo? (Valor: 0,60)

Responda justificadamente, empregando os argumentos jurídicos apropriados e a fundamentação legal pertinente ao caso.`,
        sections: [
          {
            aspects: [
              [
                "Denúncia espontânea does not apply to a tax subject to lançamento por homologação, regularly declared and paid late.",
                0.55,
              ],
              ["Supports that exclusion with STJ Súmula 360.", 0.1],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              [
                "Filing a judicial challenge to the same assessment waives administrative recourse or withdraws a pending administrative challenge.",
                0.5,
              ],
              [
                "Supports that procedural consequence with Law 6.830/1980 Art. 38, sole paragraph.",
                0.1,
              ],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.tax16[2],
        title: "Denúncia espontânea e ação anulatória",
      },
      {
        earned: [0, 1],
        number: 4,
        officialTotal: 0.65,
        question: `O Município "M" notificou a pessoa jurídica "Z", fabricante de peças automotivas, para que efetuasse o pagamento do Imposto sobre a Transmissão inter vivos de Bens Imóveis (ITBI), incidente sobre a transmissão de bens decorrentes de processo de incorporação de outra pessoa jurídica. Inconformada com a cobrança, a pessoa jurídica "Z" decide apresentar impugnação. Verificando a inexistência de outros débitos, após a regular apresentação da impugnação, a pessoa jurídica "Z" requer a emissão da certidão de regularidade fiscal (no caso, Certidão Positiva de Débito com efeito de Negativa), que lhe é negada, sob o argumento de que, para a sua emissão, seria necessário o depósito do montante integral do crédito cobrado.

Diante desta situação, responda aos itens a seguir.

A) Está correto o lançamento do imposto pelo Município "M"? (Valor: 0,60)

B) A pessoa jurídica "Z" tem direito à certidão de regularidade fiscal? (Valor: 0,65)

Obs.: as respostas devem ser juridicamente justificadas.`,
        sections: [
          {
            aspects: [
              ["ITBI does not apply to transfers resulting from corporate incorporation.", 0.55],
              [
                "Supports the non-incidence with Constitution Art. 156 § 2º I or CTN Art. 36 II.",
                0.1,
              ],
            ],
            id: "a",
            name: "Item A",
          },
          {
            aspects: [
              ["The administrative objection suspends enforceability of the tax debt.", 0.3],
              ["Supports the suspension with CTN Art. 151 III.", 0.1],
              [
                "Concludes that the company is entitled to the requested certificate on the facts given.",
                0.2,
              ],
            ],
            id: "b",
            name: "Item B",
          },
        ],
        text: FGV_ANSWERS.tax16[4],
        title: "ITBI na incorporação e certidão fiscal",
      },
    ],
    reference: TAX16_ARCHIVE,
    sectionTotal: 6.4,
    standard: "https://oab.fgv.br/arq/615/08062015172528_Tributario.pdf",
    task: "xvi-tax",
  }),
];
