import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { EXAM_PREP_LESSON } from "../lesson-writer/exam-prep-lesson-spec";

/**
 * A shared lesson written for an exam's candidates: Sol's draft of "Finalidades da OAB" from the
 * lesson-writer eval with the exam in `EXAMS` (7 Oct 2026). It names the OAB, the Constitution and
 * the Estatuto without explaining them, as law candidates know them, and cites art. 44.
 */
const lesson: WrittenLesson = {
  screens: [
    {
      image: null,
      kind: "hookGuess",
      options: [
        { isCorrect: false, text: "Só cobrar providências contra a demora." },
        { isCorrect: false, text: "Só defender advogados em questões da profissão." },
        { isCorrect: true, text: "As duas propostas." },
        { isCorrect: false, text: "Nenhuma das duas propostas." },
      ],
      question:
        "Lorena leva duas propostas à OAB: cobrar providências contra a demora dos processos e defender advogados em questões da profissão. Quais podem corresponder a finalidades da OAB?",
      reveal:
        "As duas propostas podem corresponder a finalidades da OAB. Nas próximas telas, você vai ver por quê.",
      visual: null,
    },
    {
      context:
        "Raimundo vê que um recurso demora a ser julgado. Ele sugere que a OAB passe a decidi-lo no lugar dos juízes.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason:
            "Você distingue cobrar providências de decidir um caso. A demora pode motivar uma cobrança da OAB, não transferir a ela o papel dos juízes.",
          text: "A OAB pode cobrar melhorias na Justiça, mas não assumir o julgamento do recurso.",
        },
        {
          isCorrect: false,
          reason:
            "Você parte de uma preocupação legítima com a demora, mas cobrar rapidez não dá à OAB poder para julgar o recurso.",
          text: "A OAB pode julgar o recurso, pois combater a demora lhe dá esse poder.",
        },
        {
          isCorrect: false,
          reason:
            "Você tenta resolver a questão pelo acordo das partes, mas esse acordo não transforma a OAB em órgão julgador do recurso.",
          text: "A OAB só pode julgar o recurso se as partes concordarem.",
        },
        {
          isCorrect: false,
          reason:
            "Você evita que a OAB julgue o recurso, mas vai longe demais: ela pode cobrar providências para melhorar a Justiça.",
          text: "A OAB não pode nem cobrar providências contra a demora.",
        },
      ],
      question: "Como você avalia a proposta de Raimundo?",
      visual: null,
    },
    {
      exampleLineIdea: "A defesa de direitos humanos de moradores da cidade do aluno.",
      image: null,
      kind: "explanation",
      text: "Quando a OAB defende direitos humanos de moradores, ela age por um interesse de todos, não só de advogados. Essa é uma **finalidade institucional**. Pelo art. 44, I, do Estatuto da Advocacia, ela inclui defender a Constituição, a ordem jurídica do Estado democrático de direito, os direitos humanos e a justiça social.",
      title: "Atuação por todos",
      visual: null,
    },
    {
      exampleLineIdea:
        "Uma cobrança por providências diante de atrasos no fórum da cidade do aluno.",
      image: null,
      kind: "explanation",
      text: "Diante de processos atrasados, a OAB pode cobrar providências, mas não decidir os casos. O art. 44, I, também manda a OAB pugnar pela boa aplicação das leis, pela rápida administração da justiça e pelo aperfeiçoamento da cultura e das instituições jurídicas.",
      title: "Justiça sem demora",
      visual: null,
    },
    {
      context:
        "Thaís vê processos parados e afirma que a OAB só pode cobrar rapidez da Justiça se também provar que alguma lei foi aplicada incorretamente.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason:
            "Você pode apontar a demora sem ter de provar uma aplicação incorreta da lei. O art. 44, I, prevê as duas atuações sem fazer de uma condição da outra.",
          text: "Não. A rápida administração da justiça é uma finalidade prevista por si.",
        },
        {
          isCorrect: false,
          reason:
            "Você trata duas atuações do art. 44, I, como requisitos cumulativos. O texto também prevê a rápida administração da justiça por si.",
          text: "Sim. Cobrar rapidez exige provar antes que uma lei foi mal aplicada.",
        },
        {
          isCorrect: false,
          reason:
            "Você restringe a cobrança aos interesses da profissão. A rápida administração da justiça interessa à sociedade e consta do art. 44, I.",
          text: "Sim. A OAB só pode cobrar rapidez quando representa advogados.",
        },
        {
          isCorrect: false,
          reason:
            "Você dispensa a condição criada por Thaís, mas troca a cobrança por um poder de julgamento que essa finalidade não concede.",
          text: "Não. Para acelerar o caso, a OAB pode julgá-lo diretamente.",
        },
      ],
      question: "A condição apresentada por Thaís está correta?",
      visual: null,
    },
    {
      exampleLineIdea: "A seleção de profissionais que vão exercer a advocacia.",
      image: null,
      kind: "explanation",
      text: "Selecionar advogados diz respeito aos profissionais da advocacia. Essa é uma **finalidade corporativa**. Pelo art. 44, II, do Estatuto da Advocacia, cabe à OAB promover, com exclusividade, a representação, a defesa, a seleção e a disciplina dos advogados em toda a República Federativa do Brasil. A exclusividade vale para essas atribuições; não limita todas as finalidades da OAB aos advogados.",
      title: "Atuação pela profissão",
      visual: null,
    },
    {
      context:
        "Murilo lê que a OAB atua com exclusividade na seleção de advogados. Ele conclui que ela não pode defender os direitos humanos de quem não é advogado.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason:
            "Você separa as duas finalidades: a exclusividade qualifica as atribuições relativas aos advogados, sem eliminar a defesa dos direitos humanos prevista no inciso I.",
          text: "Ele estende a exclusividade do art. 44, II, à defesa de interesses de toda a sociedade prevista no inciso I.",
        },
        {
          isCorrect: false,
          reason:
            "Você aplica a exclusividade a toda atuação da OAB. O art. 44, II, a liga às atribuições relativas aos advogados; o inciso I trata também de interesses de todos.",
          text: "Ele esquece que a exclusividade vale para toda atuação da OAB, inclusive a defesa de direitos humanos.",
        },
        {
          isCorrect: false,
          reason:
            "Você troca as finalidades: selecionar advogados é uma atribuição referente à profissão, prevista no art. 44, II.",
          text: "Ele ignora que a seleção de advogados pertence às finalidades voltadas ao interesse de todos.",
        },
        {
          isCorrect: false,
          reason:
            "Você mistura a defesa dos direitos humanos, prevista no inciso I, com a disciplina dos advogados, prevista no inciso II.",
          text: "Ele supõe que defender direitos humanos faz parte apenas da disciplina dos advogados.",
        },
      ],
      question: "Onde está o erro de Murilo?",
      visual: null,
    },
    {
      context:
        "Em Belém, Sabrina analisa três pedidos dirigidos à OAB: cobrar providências diante de violações de direitos humanos; promover a seleção de advogados; assumir o julgamento de recursos atrasados.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason:
            "Você liga a defesa dos direitos humanos ao inciso I e a seleção de advogados ao inciso II. Nenhum dos dois dá à OAB o julgamento de recursos.",
          text: "Art. 44, I; art. 44, II; não decorre dessas finalidades.",
        },
        {
          isCorrect: false,
          reason:
            "Você classifica os dois primeiros como voltados à profissão por serem pedidos à OAB. Mas defender direitos humanos também atende ao interesse de todos e está no inciso I.",
          text: "Art. 44, II; art. 44, II; não decorre dessas finalidades.",
        },
        {
          isCorrect: false,
          reason:
            "Você classifica corretamente os dois primeiros, mas confunde cobrar uma Justiça rápida com assumir o julgamento dos recursos.",
          text: "Art. 44, I; art. 44, II; art. 44, I.",
        },
        {
          isCorrect: false,
          reason:
            "Você reconhece a defesa dos direitos humanos e rejeita o julgamento pela OAB, mas coloca a seleção de advogados no inciso I. Ela está no inciso II.",
          text: "Art. 44, I; art. 44, I; não decorre dessas finalidades.",
        },
      ],
      question: "Qual classificação dos três pedidos está correta, na ordem?",
      visual: null,
    },
  ],
  summary: [
    "Pelo art. 44, I, do Estatuto da Advocacia, a OAB defende interesses da sociedade, como os direitos humanos e a justiça social.",
    "A OAB pode cobrar a boa aplicação das leis e a rápida administração da justiça, mas essas finalidades não lhe dão poder para julgar recursos.",
    "Pelo art. 44, II, a OAB promove com exclusividade a representação, a defesa, a seleção e a disciplina dos advogados em todo o Brasil; isso não elimina suas finalidades voltadas à sociedade.",
  ],
};

export const EXAM_PREP_BASE_LESSON = { ...EXAM_PREP_LESSON, lesson };
