import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";

/**
 * A production lesson (8 Nov 2026) whose guess is right under one measure only: the ratio of the
 * shares that reach the top falls, the gap grows, and the odds ratio the lesson teaches stays.
 */
export const MOBILITY_LESSON: Pick<
  WriteLessonDraftParams,
  "chapterLessons" | "chapterTitle" | "courseTitle" | "exams" | "language" | "level"
> & { spec: LessonSpec } = {
  chapterLessons: [
    {
      canDo: "Analisar a posição social por classe, renda, ocupação e patrimônio",
      examples: [
        "Tainá e uma colega recebem o mesmo salário. As duas ficam sem trabalho, e só a colega consegue passar meses sem aperto. Por que salários iguais não garantem a mesma segurança financeira?",
        "A empresa de Edson teve um mês ruim, e ele não tirou nenhum dinheiro dela. Os empregados receberam salário normalmente. Naquele mês, a posição social de Edson ficou abaixo da deles?",
        "Uma equipe da prefeitura compara dois perfis fictícios. | Perfil | Renda mensal | Patrimônio líquido | |---|---:|---:| | A | R$ 8.000 | R$ 20.000 | | B | R$ 5.000 | R$ 300.000 | Qual perfil recebe mais por mês, mas tem menos riqueza acumulada?",
        "Marília tinha R$ 90.000 guardados e comprou à vista um terreno desse valor, sem outros custos. Um relatório lista o terreno e também os R$ 90.000 entre os bens dela. Como o relatório deve ser corrigido?",
        "Um cadastro registra Davi e Raíssa como cozinheiros. Davi é empregado de um restaurante. Raíssa é dona de um restaurante e contrata a equipe. O que o cadastro permite afirmar sobre os dois?",
        "Para um diagnóstico do Cadastro Único, uma equipe da prefeitura de Pelotas compara dois perfis fictícios e conclui: _Fábio está acima de Cíntia em todas as dimensões_. | Perfil | Ocupação | Renda mensal | Patrimônio líquido | |---|---|---:|---:| | Fábio | Cozinheiro empregado | R$ 6.000 | R$ 15.000 | | Cíntia | Cozinheira dona, com empregados | R$ 4.500 | R$ 250.000 | Qual correção torna a conclusão da equipe adequada?",
      ],
      ideas: [
        "A estratificação social é a organização da sociedade em posições com acesso desigual a recursos.",
        "Analisar a classe social é olhar quem possui os negócios e quem vive de vender seu trabalho, e uma renda maior não transforma um empregado em proprietário.",
        "Renda é o dinheiro recebido num período, enquanto patrimônio líquido é o valor dos bens e direitos menos as dívidas, que não cresce ao trocar dinheiro por um bem de igual valor.",
        "Ocupação é a atividade exercida no trabalho, e duas pessoas com a mesma ocupação podem ter posições diferentes quanto à propriedade.",
      ],
      order: "before",
      title: "Dimensões da estratificação social",
    },
    {
      canDo: "Analisar como instituições reproduzem ou reduzem desigualdades sociais",
      examples: [
        "Priscila tem a formação e a experiência que a vaga pede. Mesmo assim, só chegam à entrevista os candidatos indicados por funcionários da empresa. Como uma seleção pode favorecer alguns antes de avaliar o que cada um sabe fazer?",
        "Uma escola técnica de Pelotas passa a selecionar alunos com uma prova idêntica para todos e sem taxa de inscrição. O que acontece com o peso da origem familiar no resultado?",
        "Julgue o item: _Uma seleção escolar sem favorecimento pessoal não pode reproduzir desigualdades familiares._",
        "Em Maringá, o edital exige curso pago; só indicados são entrevistados. Quais mecanismos?",
        "O regulamento de uma bolsa de pesquisa em Chapecó exige um certificado pago. Na prática, os avaliadores só entrevistam pessoas que já conhecem. Como se classifica cada mecanismo, na ordem em que aparecem?",
        "Julgue o item: _A ausência de contribuições previdenciárias permite concluir que uma família está excluída de toda proteção social._",
      ],
      ideas: [
        "Instituições são regras e padrões duradouros que orientam condutas, como os critérios que decidem que texto ganha nota alta numa escola.",
        "Uma prova igual para todos pode premiar o capital cultural aprendido em casa, e assim a vantagem passa de pais para filhos como tendência do grupo, não como destino de cada pessoa.",
        "Uma regra formal é uma exigência escrita, como um certificado pago no edital, e uma prática informal decide sem estar escrita, como entrevistar só indicados.",
        "A previdência protege quem contribuiu, por isso trajetórias com períodos sem pagar o INSS dificultam a aposentadoria, mas quem trabalha por conta própria pode contribuir.",
        "A assistência social protege quem precisa sem exigir contribuição prévia, desde que cumpra os critérios da lei, e assim ajuda a reduzir desigualdades.",
      ],
      order: "after",
      title: "Instituições e reprodução social",
    },
    {
      canDo: "Relacionar cidadania formal e acesso efetivo a direitos",
      examples: [],
      ideas: [],
      order: "after",
      title: "Cidadania e acesso a direitos",
    },
    {
      canDo: "Tomar decisões com as habilidades deste capítulo",
      examples: [],
      ideas: [],
      order: "after",
      title: "Desafio: Estratificação, mobilidade e cidadania",
    },
  ],
  chapterTitle: "Estratificação, mobilidade e cidadania",
  courseTitle: "Administração Pública",
  exams: [
    {
      name: "Concurso CGU",
      style:
        "trueFalse: Itens para julgamento individual como Certo ou Errado. essay: Questão discursiva relacionada a conhecimentos complementares a ser respondida em até 30 linhas. essay: Questão discursiva envolvendo situação-problema relacionada a conhecimentos específicos a ser respondida em até 60 linhas.",
    },
  ],
  language: "pt",
  level: "intermediate",
  spec: {
    canDo: "Distinguir mobilidade absoluta e relativa em trajetórias pessoais e geracionais",
    description:
      "Diferenciar mudanças de posição social da redução das vantagens de origem, comparando gerações e trajetórias ao longo da vida.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Leandro conseguiu uma ocupação melhor que a dos pais, mas percebe que os cargos mais disputados continuam nas mesmas famílias. Mais gente subir significa oportunidades mais iguais?",
        kind: "hook",
        skills: [],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mobilidade absoluta é a proporção de pessoas que mudam de posição social: se 30 de 100 filhos ocupam uma posição diferente da dos pais, ela é de 30%. A mudança pode ser para cima ou para baixo.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Tabela fictícia, colunas período/origem/destino baixo/destino alto: A/baixa/90/10; A/alta/50/50; B/baixa/75/25; B/alta/25/75. Perguntar como muda a vantagem da origem alta para alcançar o topo: diminui, permanece igual ou aumenta; correta: permanece igual.",
        kind: "guess",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "A vantagem de origem permaneceu igual, apesar de mais pessoas chegarem ao topo. A mobilidade relativa compara a facilidade de alcançar uma posição conforme a origem social: quanto menor essa dependência, maior a mobilidade relativa.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Para comparar essa facilidade, usamos a razão entre quem alcança a posição e quem não alcança, chamada odds. Na origem baixa do período A, são 10 para 90: 10/90 = 1/9.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mostrar em etapas a vantagem de origem no período A: origem alta, 50/50 = 1; origem baixa, 10/90 = 1/9; comparação, 1 ÷ (1/9) = 9. A origem alta tem nove vezes as odds da origem baixa.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "No período B, mostrar origem baixa: 75 no destino baixo e 25 no alto; origem alta: 25 no baixo e 75 no alto. Pedir a vantagem da origem alta: correta 9; incluir 3, erro de usar apenas 75/25 sem comparar as origens.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "A abertura de mais posições superiores pode aumentar as subidas sem reduzir a vantagem de origem. Entre A e B, os filhos de origem baixa que chegaram ao topo passaram de 10 para 25, mas a vantagem continuou em nove vezes.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Julgar: “Uma pesquisa registrou mais mudanças de posição; logo, comprovou menor desigualdade de oportunidades”. Gabarito: Errado; incluir Certo como resposta tentadora por confundir quantidade de mudanças com menor dependência da origem.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Comparar a posição de filhos com a dos pais é analisar mobilidade intergeracional. Uma filha na direção de uma empresa e sua mãe em trabalho de baixa posição, ambas observadas aos 40 anos, exemplificam essa comparação.",
        kind: "explanation",
        skills: [1],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Comparar posições da mesma pessoa ao longo da vida é analisar mobilidade intrageracional. Uma trabalhadora que passa de auxiliar a gerente apresenta essa trajetória, mesmo sem informação sobre seus pais.",
        kind: "explanation",
        skills: [1],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Julgar: “Uma pesquisa que compara a ocupação de cada participante aos 25 e aos 50 anos mede mobilidade intergeracional”. Gabarito: Errado; a armadilha é confundir duas idades da mesma pessoa com duas gerações familiares.",
        kind: "check",
        skills: [1],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Um relatório traz mobilidade absoluta de 20% para 35%, vantagem de origem fixa em nove vezes, Valéria promovida de auxiliar a gerente e Danilo gerente, filho de auxiliar. Pedir um parecer: não houve redução da vantagem de origem; Valéria exemplifica mobilidade intrageracional e Danilo, intergeracional; incluir a conclusão tentadora de oportunidades mais iguais.",
        kind: "application",
        skills: [0, 1],
        visual: null,
        visualKind: "none",
      },
    ],
    skills: [
      {
        description:
          "Diferenciar a proporção de mudanças de posição social da intensidade da associação entre origem e destino social.",
        example:
          "As subidas de filhos de origem baixa passam de 10 para 25, enquanto a vantagem de origem alta permanece em nove vezes nas odds de alcançar o topo.",
        hard: true,
        name: "Distinguir mobilidade social absoluta e relativa",
        topic: "Mobilidade absoluta e relativa",
        useCase:
          "Avaliar se um relatório demonstra mais mudanças sociais ou também menor desigualdade de oportunidades.",
      },
      {
        description:
          "Diferenciar comparações entre pais e filhos de mudanças na trajetória de uma mesma pessoa.",
        example:
          "Comparar filha e mãe aos 40 anos é uma análise intergeracional; comparar uma trabalhadora aos 25 e aos 50 anos é intrageracional.",
        hard: false,
        name: "Distinguir mobilidade intergeracional e intrageracional",
        topic: "Mobilidade entre gerações",
        useCase:
          "Identificar o que pesquisas sobre origem familiar e trajetórias profissionais efetivamente medem.",
      },
    ],
    title: "Mobilidade social e oportunidades",
  },
};
