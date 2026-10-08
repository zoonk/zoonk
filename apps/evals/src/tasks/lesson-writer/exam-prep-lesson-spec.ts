import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";

/**
 * A shared lesson the learners of an exam goal study: the plan the lesson-spec eval wrote for
 * "Finalidades da OAB" with the exam in `EXAMS` (7 Oct 2026), so the writer is checked on writing
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
