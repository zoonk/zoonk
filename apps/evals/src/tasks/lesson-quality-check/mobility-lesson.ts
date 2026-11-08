import { type WrittenLesson } from "@zoonk/ai/tasks/lesson-writer/schema";
import { MOBILITY_LESSON } from "../lesson-writer/mobility-lesson-spec";

const lesson: WrittenLesson = {
  screens: [
    {
      image: null,
      kind: "hookText",
      text: "Leandro passou num concurso e hoje ganha bem mais que os pais, que eram faxineiros. Mas os cargos de chefia do órgão continuam com filhos das mesmas famílias. Se mais gente sobe, as chances ficaram mais iguais?",
      visual: null,
    },
    {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: "Imagine 100 filhos comparados aos pais. Se 30 estão numa posição social diferente, para cima ou para baixo, a mudança atingiu 30% deles. Essa proporção se chama **mobilidade absoluta**.",
      title: "Quantos mudaram de lugar",
      visual: null,
    },
    {
      image: null,
      kind: "hookGuess",
      options: [
        { isCorrect: false, text: "Diminui" },
        { isCorrect: false, text: "Aumenta" },
        { isCorrect: true, text: "Permanece igual" },
      ],
      question:
        "No estudo fictício, no período A, 10 de 100 filhos de origem baixa e 50 de 100 de origem alta chegaram ao topo. No B, foram 25 e 75. Como mudou a vantagem da origem alta?",
      reveal:
        "A vantagem da origem alta permanece igual nos dois períodos, mesmo com mais filhos de origem baixa chegando ao topo.",
      visual: null,
    },
    {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: "Em B, mais filhos de origem baixa chegaram ao topo, mas a vantagem de quem vem de cima não mudou. Comparar a chance de chegar ao topo conforme a origem é medir a **mobilidade relativa**. Quanto menos a origem pesa, maior ela é.",
      title: "A origem ainda pesa",
      visual: null,
    },
    {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: "Na origem baixa do período A, 10 filhos chegaram ao topo e 90 não chegaram. A razão entre quem chega e quem não chega é $10/90 = 1/9$. Essa razão se chama **odds**.",
      title: "Chances em forma de razão",
      visual: null,
    },
    {
      image: null,
      kind: "workedExample",
      problem: "No período A, quantas vezes as odds da origem alta superam as da baixa?",
      result: "A origem alta tem nove vezes as odds da origem baixa.",
      steps: [
        { math: String.raw`\frac{50}{50}=1`, text: "Alta: 50 chegam e 50 não." },
        { math: String.raw`\frac{10}{90}=\frac{1}{9}`, text: "Baixa: 10 chegam e 90 não." },
        { math: String.raw`1\div\frac{1}{9}=9`, text: "Divida as odds da alta pelas da baixa." },
      ],
      title: "A vantagem no período A",
      visual: null,
    },
    {
      basis: { quote: "Divida as odds da alta pelas da baixa.", screen: 6 },
      context:
        "Num período C fictício, o estudo registrou:\n\n| Origem | Destino baixo | Destino alto |\n|---|---:|---:|\n| Baixa | 60 | 40 |\n| Alta | 20 | 80 |",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: false,
          picture: null,
          reason:
            "Você dividiu quem chegou ao topo em cada origem e ignorou quem não chegou. As odds sempre põem quem chega contra quem não chega.",
          text: "2",
        },
        {
          isCorrect: false,
          picture: null,
          reason:
            "Você subtraiu as odds. Para saber quantas vezes uma é maior que a outra, é preciso dividir.",
          text: "3,3",
        },
        {
          isCorrect: false,
          picture: null,
          reason:
            "Você calculou as odds da origem alta, mas não as comparou com as da origem baixa. A vantagem é a divisão entre as duas.",
          text: "4",
        },
        {
          isCorrect: true,
          picture: null,
          reason:
            "As odds da origem alta são 80 para 20, e as da baixa são 40 para 60. Dividindo as primeiras pelas segundas, você obtém quantas vezes a origem alta está à frente.",
          text: "6",
        },
      ],
      question:
        "Quantas vezes as odds da origem alta de chegar ao destino alto são maiores que as da origem baixa?",
      visual: null,
    },
    {
      exampleLineIdea:
        "uma notícia sobre mais jovens de famílias pobres entrando na universidade ou no serviço público",
      explore: null,
      image: null,
      kind: "explanation",
      text: "De A para B, os filhos de origem baixa que chegaram ao topo passaram de 10 para 25. Mas a vantagem da origem alta seguiu em nove vezes. Abrir mais vagas no topo aumenta as subidas sem tirar o peso da origem.",
      title: "Mais subidas, mesma vantagem",
      visual: null,
    },
    {
      basis: {
        quote: "Abrir mais vagas no topo aumenta as subidas sem tirar o peso da origem.",
        screen: 8,
      },
      context: "Julgue o item a seguir, extraído de um relatório sobre desigualdade.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: false,
          picture: null,
          reason:
            "Mais mudanças de posição mostram mobilidade absoluta, não menor peso da origem. Parece certo porque mais gente subindo sugere portas mais abertas.",
          text: "Certo",
        },
        {
          isCorrect: true,
          picture: null,
          reason:
            "O item confunde mobilidade absoluta com relativa. Só uma vantagem de origem menor comprovaria oportunidades mais iguais.",
          text: "Errado",
        },
      ],
      question:
        "_Uma pesquisa registrou mais mudanças de posição social; logo, comprovou menor desigualdade de oportunidades._",
      visual: null,
    },
    {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: "Iara dirige uma empresa aos 40 anos. Com a mesma idade, a mãe dela trabalhava como diarista. Comparar a posição dos filhos com a dos pais é analisar a **mobilidade intergeracional**.",
      title: "Filha e mãe aos 40 anos",
      visual: null,
    },
    {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: "Nayara entrou numa empresa como auxiliar e hoje é gerente. Mesmo sem saber nada dos pais dela, dá para ver uma mudança. Comparar posições da mesma pessoa ao longo da vida é analisar a **mobilidade intrageracional**.",
      title: "A mesma pessoa, anos depois",
      visual: null,
    },
    {
      basis: {
        quote:
          "Comparar posições da mesma pessoa ao longo da vida é analisar a **mobilidade intrageracional**.",
        screen: 11,
      },
      context: "Julgue o item a seguir.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: false,
          picture: null,
          reason:
            "Aos 25 e aos 50 anos, é a mesma pessoa, não duas gerações. A diferença de idade engana porque lembra a distância entre pais e filhos.",
          text: "Certo",
        },
        {
          isCorrect: true,
          picture: null,
          reason:
            "A pesquisa acompanha a mesma pessoa ao longo da vida, o que é mobilidade intrageracional. Para ser intergeracional, teria de comparar cada participante com os pais.",
          text: "Errado",
        },
      ],
      question:
        "_Uma pesquisa que compara a ocupação de cada participante aos 25 e aos 50 anos mede mobilidade intergeracional._",
      visual: null,
    },
    {
      basis: null,
      context:
        "Relatório: a mobilidade absoluta subiu de 20% para 35%; a vantagem da origem alta ficou em nove vezes. Valéria passou de auxiliar a gerente. Danilo, filho de auxiliar, é gerente.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: false,
          picture: null,
          reason:
            "A vantagem seguiu em nove vezes, então as chances não ficaram mais iguais. E Valéria mudou na própria carreira, o que é mobilidade intrageracional.",
          text: "As oportunidades ficaram mais iguais, e Valéria e Danilo ilustram mobilidade intergeracional.",
        },
        {
          isCorrect: false,
          picture: null,
          reason:
            "A mobilidade absoluta subiu, mas a vantagem seguiu em nove vezes, então a origem pesa o mesmo. A alta de 20% para 35% é que torna essa conclusão tentadora.",
          text: "As oportunidades ficaram mais iguais, e Valéria ilustra mobilidade intrageracional e Danilo, intergeracional.",
        },
        {
          isCorrect: false,
          picture: null,
          reason:
            "Os tipos estão trocados. Valéria foi comparada com ela mesma ao longo da carreira, e Danilo foi comparado com a pessoa de origem auxiliar.",
          text: "A origem pesa o mesmo, e Valéria ilustra mobilidade intergeracional e Danilo, intrageracional.",
        },
        {
          isCorrect: true,
          picture: null,
          reason:
            "A vantagem fixa em nove vezes mostra que a origem não perdeu peso. Valéria mudou na própria carreira, e Danilo foi comparado com a pessoa de origem auxiliar.",
          text: "A origem pesa o mesmo, e Valéria ilustra mobilidade intrageracional e Danilo, intergeracional.",
        },
      ],
      question: "Qual parecer está correto?",
      visual: null,
    },
  ],
  summary: {
    ideas: [
      {
        label: "Absoluta: quantos mudam",
        text: "A mobilidade absoluta é a proporção de filhos que estão numa posição social diferente da dos pais, para cima ou para baixo.",
      },
      {
        label: "Relativa: peso da origem",
        text: "A mobilidade relativa compara a chance de chegar ao topo conforme a origem, dividindo as odds de cada origem, que põem quem chega contra quem não chega.",
      },
      {
        label: "Mais subidas, mesma vantagem",
        text: "Abrir mais vagas no topo aumenta as subidas sem tirar o peso da origem, como quando a vantagem da origem alta segue em nove vezes.",
      },
      {
        label: "Intergeracional: filhos e pais",
        text: "Comparar a posição dos filhos com a dos pais é analisar a mobilidade intergeracional.",
      },
      {
        label: "Intrageracional: mesma pessoa",
        text: "Comparar posições da mesma pessoa ao longo da vida é analisar a mobilidade intrageracional.",
      },
    ],
    shape: "hub",
  },
};

export const MOBILITY_BASE_LESSON = { ...MOBILITY_LESSON, lesson };
