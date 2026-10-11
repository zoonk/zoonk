import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";

/**
 * A shared lesson the learners of an exam goal study: the plan the lesson-spec eval wrote for
 * "Purposes of the OAB" with the exam in `EXAMS` (7 Oct 2026), so the writer is checked on writing
 * it for law graduates at that exam's depth, with the statute's articles and exam-like wrong
 * options, without naming the exam.
 */
export const EXAM_PREP_LESSON: Pick<
  WriteLessonDraftParams,
  "chapterTitle" | "courseTitle" | "exams" | "language" | "level"
> & { spec: LessonSpec } = {
  chapterTitle: "Estrutura e competências da OAB",
  courseTitle:
    "Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina da OAB",
  exams: [
    {
      name: "OAB Exame de Ordem Unificado, 1ª fase",
      style:
        "multipleChoice (4 options): Questões de múltipla escolha com 4 opções (A, B, C e D) e uma única resposta correta.",
    },
  ],
  language: "pt",
  level: "beginner",
  spec: {
    canDo: "Distinguir as finalidades institucionais das corporativas da OAB",
    description:
      "As finalidades previstas no Estatuto mostram quando a OAB atua em defesa da sociedade e quando atua em relação aos advogados.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Lorena leva à OAB duas propostas: cobrar providências para reduzir a demora dos processos e defender advogados em questões da profissão. Pergunte quais podem corresponder a finalidades da OAB: A) só a primeira; B) só a segunda; C) ambas; D) nenhuma. Resposta: C; mostre-a após a escolha e deixe a explicação para as próximas telas.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Raimundo sugere que a OAB, diante da demora de um processo, passe a decidir o recurso no lugar dos juízes. Peça que o aluno julgue a proposta: a resposta correta é que cobrar melhorias na Justiça não autoriza a OAB a julgar; inclua como alternativa tentadora que combater a demora lhe dá esse poder.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Apresente a finalidade institucional como a atuação voltada ao interesse de todos, não apenas ao de uma profissão. Pelo art. 44, I, do Estatuto da Advocacia, ela inclui defender a Constituição, a ordem jurídica do Estado democrático de direito, os direitos humanos e a justiça social.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Complete o alcance do art. 44, I, do Estatuto da Advocacia: a OAB deve pugnar pela boa aplicação das leis, pela rápida administração da justiça e pelo aperfeiçoamento da cultura e das instituições jurídicas. Use a cobrança de providências contra atrasos como exemplo, sem confundi-la com o poder de decidir processos.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Thaís afirma que a OAB só pode cobrar rapidez da Justiça se também demonstrar que alguma lei foi aplicada incorretamente. Peça que o aluno julgue a afirmação: ela é incorreta, pois a rápida administração da justiça é uma finalidade prevista por si; a resposta tentadora é tratar as duas atuações do art. 44, I, como requisitos cumulativos.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Apresente a finalidade corporativa como a atuação referente aos profissionais da advocacia. Pelo art. 44, II, do Estatuto da Advocacia, cabe à OAB promover, com exclusividade, a representação, a defesa, a seleção e a disciplina dos advogados em toda a República Federativa do Brasil; explique que a exclusividade qualifica essas atribuições, não limita todas as finalidades da OAB aos advogados.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Murilo lê que a OAB atua com exclusividade na seleção de advogados e conclui que ela não pode defender direitos humanos de pessoas que não sejam advogadas. Peça que o aluno identifique o erro: a exclusividade do art. 44, II, não elimina a finalidade institucional do inciso I; inclua como alternativa tentadora a aplicação da exclusividade a toda atuação da OAB.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Sabrina analisa três pedidos dirigidos à OAB: cobrar providências diante de violações de direitos humanos, promover a seleção de advogados e assumir o julgamento de recursos atrasados. Peça que escolha a classificação completa: o primeiro corresponde ao art. 44, I, o segundo ao art. 44, II, e o terceiro não decorre dessas finalidades. Inclua como alternativa tentadora classificar os dois primeiros como corporativos por serem dirigidos à OAB.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Distinguir a atuação da OAB em defesa da ordem jurídica e da sociedade daquela referente à representação e à organização da advocacia.",
        example:
          "Cobrar rapidez da Justiça é finalidade institucional; selecionar advogados é finalidade corporativa.",
        hard: false,
        name: "Distinguir as finalidades da OAB",
        topic: "Finalidades da OAB",
        useCase:
          "Analisar se uma atuação atribuída à OAB corresponde às finalidades previstas no Estatuto.",
      },
    ],
    supportMode: "questionFirst",
    title: "Finalidades da OAB",
  },
};

/**
 * A question-first lesson a TJ-SP clerk candidate studied (persona pass 12, 10 Oct 2026): the plan
 * the lesson spec wrote, with a check right after the hook. Its writer opened the explanation after
 * that check by telling the learner they had started with the right question, praise every learner
 * who missed the check read too.
 */
export const QUESTION_FIRST_EXAM_LESSON: Pick<
  WriteLessonDraftParams,
  "chapterTitle" | "courseTitle" | "exams" | "language" | "level"
> & { spec: LessonSpec } = {
  chapterTitle: "Culpabilidade e responsabilidade pessoal",
  courseTitle: "Direito Penal",
  exams: [{ name: "Concurso TJ-SP", style: "multipleChoice: Questões de múltipla escolha." }],
  language: "pt",
  level: "beginner",
  spec: {
    canDo: "Classificar um fato pelo primeiro elemento do crime que falha",
    description:
      "Uma sequência de perguntas ajuda a distinguir fatos que não se enquadram na lei, fatos justificados e fatos pelos quais a pessoa não pode ser responsabilizada.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Kauã empurra quem está prestes a agredi-lo e causa uma lesão, usando apenas a força necessária para impedir o golpe. Pergunte qual conclusão parece melhor: A) não houve lesão; B) houve lesão, mas a reação necessária pode ser permitida; C) a lesão deixa de importar se Kauã se arrepender. Revele B assim que o aluno escolher, sem explicar ainda por quê.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Tainá é acusada de pegar a bicicleta de outra pessoa, mas afirma que a bicicleta é dela. Pergunte qual informação deve ser verificada primeiro: a quem pertence a bicicleta (correta), se Tainá estava com pressa ou se alguém ficou irritado com ela.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Apresente tipicidade como o encaixe inicial entre o fato e a descrição da lei. No furto, a lei exige que a coisa móvel retirada pertença a outra pessoa (art. 155 do Código Penal); pegar a própria bicicleta não preenche essa descrição.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Explique que um fato pode corresponder à descrição da lei e, ainda assim, ser permitido nas circunstâncias. Chame de ilicitude a contrariedade do fato ao direito: é a segunda pergunta, feita somente depois da tipicidade.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Apresente a legítima defesa: repelir agressão injusta, atual ou iminente, com meios necessários usados moderadamente pode afastar a ilicitude (arts. 23, II, e 25 do Código Penal). Compare a reação necessária com continuar a agredir depois que o perigo acabou.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Edson causa uma lesão ao empurrar, com a força necessária, alguém que estava prestes a agredir outra pessoa. Peça a conclusão: o fato não corresponde à descrição de lesão, corresponde mas a reação afasta a ilicitude (correta), ou só seria permitido se Edson conhecesse o agressor; a primeira opção é a confusão a explorar.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "decisionTree",
        brief:
          "Apresente culpabilidade como a possibilidade de responsabilizar pessoalmente alguém por um fato típico e ilícito. Mostre uma árvore para explorar, sem pedir resposta: o fato corresponde à descrição legal? Se não, pare; se sim, há causa que afaste a ilicitude? Se sim, pare; se não, a pessoa pode ser responsabilizada? Se não, falta culpabilidade; se sim, os três elementos estão presentes. Um menor de 18 anos não é penalmente imputável (art. 27 do Código Penal).",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Resolva passo a passo: Marília, adulta, danifica intencionalmente uma vitrine alheia porque sofre coação moral irresistível. O fato se enquadra no dano (art. 163 do Código Penal); não foi apresentada causa que afaste a ilicitude; a coação moral irresistível impede sua responsabilização pessoal (art. 22). Conclua: fato típico e ilícito, mas sem culpabilidade.",
        kind: "workedExample",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Davi, de 17 anos, danifica intencionalmente o celular alheio por vingança, sem circunstância que permita o ato. Peça que classifique o fato com menos ajuda que no exemplo: típico e ilícito, mas sem culpabilidade (correta); atípico porque Davi é menor de idade; ou lícito porque Davi é menor de idade. Aplique os arts. 163 e 27 do Código Penal.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "decisionTree",
        brief:
          "Raíssa, adulta, causa uma lesão ao imobilizar com força moderada quem agredia naquele momento uma colega; era a força necessária para interromper a agressão. Peça ao aluno que percorra as perguntas da árvore: lesão descrita na lei, sim; causa que afasta a ilicitude, sim, legítima defesa (arts. 23, II, e 25 do Código Penal). A pergunta sobre culpabilidade não precisa ser percorrida; o resultado é fato típico, mas não ilícito.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Num registro de ocorrência, Fábio lê que uma pessoa de 17 anos causou uma lesão ao repelir, com força necessária e moderada, uma agressão injusta que estava acontecendo. Peça que escolha qual dado resolve primeiro a análise após reconhecer a lesão (a reação à agressão ou a idade) e classifique o fato: a legítima defesa afasta a ilicitude antes que seja preciso examinar a culpabilidade; a alternativa tentadora é pular diretamente para a idade (arts. 23, II, 25 e 27 do Código Penal).",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Examina, em ordem, se o fato corresponde à descrição legal, se há causa que afaste a ilicitude e se a pessoa pode ser responsabilizada.",
        example:
          "Uma pessoa de 17 anos danifica intencionalmente um objeto alheio sem justificativa: o fato é típico e ilícito, mas falta culpabilidade.",
        hard: true,
        name: "Analisar os elementos do crime",
        topic: "Elementos do crime",
        useCase:
          "Classificar corretamente os fatos de uma ocorrência antes de atribuir responsabilidade penal.",
      },
    ],
    supportMode: "questionFirst",
    title: "Análise de tipicidade, ilicitude e culpabilidade",
  },
};
