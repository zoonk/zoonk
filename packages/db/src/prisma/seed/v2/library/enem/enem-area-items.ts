import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** Items from the other areas that the diagnostic and mock exams mix in, in ENEM's format. */
export const enemAreaItems: SeedItem[] = [
  {
    content: {
      context: t(
        "In a pasture, grass is eaten by grasshoppers, grasshoppers by frogs, and frogs by snakes.",
        "Num pasto, o capim é comido por gafanhotos, os gafanhotos por sapos e os sapos por cobras.",
      ),
      options: [
        bankOption(
          t("Predators eat less than their prey", "Os predadores comem menos que suas presas"),
          t(
            "How much they eat isn't it: any animal turns only a small part of its food into body.",
            "Não é quanto comem: qualquer animal transforma só uma pequena parte do alimento em corpo.",
          ),
          t(
            "Thinks energy loss depends on how much predators eat",
            "Acha que a perda de energia depende de quanto os predadores comem",
          ),
        ),
        bankOption(
          t(
            "Part of the energy is lost as heat in each organism's respiration",
            "Parte da energia é perdida como calor na respiração de cada organismo",
          ),
          t(
            "Living costs energy, and respiration releases most of it as heat. Only about 10% moves up.",
            "Viver custa energia, e a respiração libera a maior parte como calor. Só cerca de 10% sobe.",
          ),
        ),
        bankOption(
          t("Plants photosynthesize less at night", "As plantas fazem menos fotossíntese à noite"),
          t(
            "That affects how much energy enters the chain, not what's lost between levels.",
            "Isso afeta quanta energia entra na cadeia, não o que se perde entre os níveis.",
          ),
          t(
            "Confuses energy capture by producers with transfer between levels",
            "Confunde a captação de energia pelos produtores com a transferência entre níveis",
          ),
        ),
        bankOption(
          t("Decomposers use up the energy first", "Os decompositores consomem a energia primeiro"),
          t(
            "Decomposers feed on waste and dead matter, after the fact.",
            "Os decompositores se alimentam de restos e matéria morta, depois.",
          ),
          t(
            "Thinks decomposers act before the next level eats",
            "Acha que os decompositores agem antes do próximo nível comer",
          ),
        ),
        bankOption(
          t("Energy turns into matter", "A energia se transforma em matéria"),
          t(
            "Energy is stored in the body's matter and mostly released as heat; it doesn't become matter.",
            "A energia fica guardada na matéria do corpo e em grande parte sai como calor; ela não vira matéria.",
          ),
          t(
            "Thinks energy becomes matter along the chain",
            "Acha que a energia vira matéria ao longo da cadeia",
          ),
        ),
      ],
      question: t(
        "In a food chain, the available energy decreases at each trophic level. What is the main reason?",
        "Numa cadeia alimentar, a energia disponível diminui a cada nível trófico. Qual é o principal motivo?",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "energy-loss-reason",
    skill: "energy-flow",
  },
  {
    content: {
      context: null,
      math: {
        answer: 500,
        commonMistakes: [
          {
            expression: "energy * 0.1",
            misconception: t("Moved up only one level", "Subiu só um nível"),
            reason: t(
              "Secondary consumers are two levels above the producers, so multiply by 0.1 twice.",
              "Os consumidores secundários estão dois níveis acima dos produtores, então multiplique por 0,1 duas vezes.",
            ),
          },
          {
            expression: "energy * 0.9^2",
            misconception: t(
              "Kept 90% at each level instead of 10%",
              "Manteve 90% em cada nível em vez de 10%",
            ),
            reason: t(
              "About 90% is lost at each level, not kept.",
              "Cerca de 90% se perde em cada nível, não fica.",
            ),
          },
        ],
        solution: "energy * 0.1^2",
        steps: [
          {
            expression: "energy * 0.1",
            text: t(
              "Primary consumers: {energy} × 0.1 = {result} kcal",
              "Consumidores primários: {energy} × 0,1 = {result} kcal",
            ),
          },
          {
            expression: "energy * 0.1^2",
            text: t(
              "Secondary consumers keep a tenth of that: {result} kcal",
              "Os secundários ficam com um décimo disso: {result} kcal",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.01 },
        unit: "kcal",
        variables: [
          { max: 500_000, min: 10_000, name: "energy", step: 10_000, unit: "kcal", value: 50_000 },
        ],
      },
      question: t(
        "The producers of an ecosystem capture {energy} kcal. On average, how much reaches the secondary consumers?",
        "Os produtores de um ecossistema captam {energy} kcal. Em média, quanto chega aos consumidores secundários?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "energy-two-levels",
    skill: "ten-percent-rule",
  },
  {
    content: {
      context: t(
        "A flashlight uses a 6 V battery connected to two resistors in series, of 2 Ω and 4 Ω.",
        "Uma lanterna usa uma bateria de 6 V ligada a dois resistores em série, de 2 Ω e 4 Ω.",
      ),
      options: [
        bankOption(
          t("0.5 A", "0,5 A"),
          t(
            "2 ÷ 4 compares the resistors; the current comes from the voltage.",
            "2 ÷ 4 compara os resistores; a corrente vem da tensão.",
          ),
          t("Divided one resistance by the other", "Dividiu uma resistência pela outra"),
        ),
        bankOption(
          t("1.0 A", "1,0 A"),
          t(
            "In series: 2 + 4 = 6 Ω, and 6 V ÷ 6 Ω = 1 A.",
            "Em série: 2 + 4 = 6 Ω, e 6 V ÷ 6 Ω = 1 A.",
          ),
        ),
        bankOption(
          t("1.5 A", "1,5 A"),
          t(
            "6 ÷ 4 uses only one resistor. In series they add up.",
            "6 ÷ 4 usa só um resistor. Em série eles se somam.",
          ),
          t("Used only the 4 Ω resistor", "Usou só o resistor de 4 Ω"),
        ),
        bankOption(
          t("3.0 A", "3,0 A"),
          t(
            "6 ÷ 2 uses only one resistor. In series they add up.",
            "6 ÷ 2 usa só um resistor. Em série eles se somam.",
          ),
          t("Used only the 2 Ω resistor", "Usou só o resistor de 2 Ω"),
        ),
        bankOption(
          t("4.5 A", "4,5 A"),
          t(
            "6 ÷ 2 + 6 ÷ 4 would be true in parallel. In series, one current flows through both.",
            "6 ÷ 2 + 6 ÷ 4 valeria em paralelo. Em série, uma única corrente passa pelos dois.",
          ),
          t("Treated a series circuit as parallel", "Tratou um circuito em série como paralelo"),
        ),
      ],
      question: t(
        "What is the electric current in the circuit?",
        "Qual é a corrente elétrica no circuito?",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "flashlight-current",
    skill: "series-resistors",
  },
  {
    content: {
      context: t(
        "The Consolidation of Labor Laws (CLT), from 1943, brought together rights such as the eight-hour workday and paid vacation.",
        "A Consolidação das Leis do Trabalho (CLT), de 1943, reuniu direitos como a jornada de oito horas e as férias remuneradas.",
      ),
      options: [
        bankOption(
          t("the First Republic", "a Primeira República"),
          t(
            "The First Republic ended in 1930, and its governments did little for urban workers.",
            "A Primeira República acabou em 1930, e seus governos pouco fizeram pelos trabalhadores urbanos.",
          ),
          t("Placed the CLT before 1930", "Situou a CLT antes de 1930"),
        ),
        bankOption(
          t("the Estado Novo, under Getúlio Vargas", "o Estado Novo, sob Getúlio Vargas"),
          t(
            "The CLT is from 1943, in the Estado Novo (1937–1945).",
            "A CLT é de 1943, no Estado Novo (1937–1945).",
          ),
        ),
        bankOption(
          t("the military dictatorship", "a ditadura militar"),
          t(
            "The military dictatorship began in 1964, two decades later.",
            "A ditadura militar começou em 1964, duas décadas depois.",
          ),
          t(
            "Linked labor laws to the military regime",
            "Associou as leis trabalhistas ao regime militar",
          ),
        ),
        bankOption(
          t("Juscelino Kubitschek's government", "o governo de Juscelino Kubitschek"),
          t(
            "JK governed from 1956 to 1961, after the CLT.",
            "JK governou de 1956 a 1961, depois da CLT.",
          ),
          t("Placed the CLT in the 1950s", "Situou a CLT nos anos 1950"),
        ),
        bankOption(
          t("the Empire", "o Império"),
          t(
            "The Empire ended in 1889, before any national labor law.",
            "O Império acabou em 1889, antes de qualquer lei trabalhista nacional.",
          ),
          t("Placed the CLT in the 1800s", "Situou a CLT no século 19"),
        ),
      ],
      question: t("The CLT was created during:", "A CLT foi criada durante:"),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "clt-era",
    skill: "vargas-era",
  },
  {
    content: {
      context: t(
        "Sign on a beach: “Do not feed the animals. They depend on the food they find in nature.”",
        "Placa numa praia: “Proibido alimentar os animais. Eles dependem da comida que encontram na natureza.”",
      ),
      options: [
        bankOption(
          t(
            "can make them lose the habit of finding their own food",
            "pode fazê-los perder o hábito de buscar o próprio alimento",
          ),
          t(
            "If they depend on food from nature, feeding them puts that at risk.",
            "Se eles dependem da comida da natureza, alimentá-los põe isso em risco.",
          ),
        ),
        bankOption(
          t("is allowed at some times of day", "é permitido em alguns horários"),
          t("The sign forbids it with no exceptions.", "A placa proíbe, sem exceções."),
          t("Reads a permission the text doesn't give", "Lê uma permissão que o texto não dá"),
        ),
        bankOption(
          t("is dangerous for tourists", "é perigoso para os turistas"),
          t(
            "The sign's reason is about the animals, not the tourists.",
            "O motivo da placa é sobre os animais, não sobre os turistas.",
          ),
          t(
            "Brings in a reason the text doesn't mention",
            "Traz um motivo que o texto não menciona",
          ),
        ),
        bankOption(
          t("is good for the animals' health", "faz bem para a saúde dos animais"),
          t(
            "The sign says the opposite: they should eat what they find in nature.",
            "A placa diz o contrário: eles devem comer o que encontram na natureza.",
          ),
          t("Reads the opposite of what the text says", "Lê o contrário do que o texto diz"),
        ),
        bankOption(
          t("was demanded by local fishermen", "é uma exigência dos pescadores locais"),
          t("The sign doesn't say who made the rule.", "A placa não diz quem criou a regra."),
          t("Invents who made the rule", "Inventa quem criou a regra"),
        ),
      ],
      question: t(
        "The sign suggests that feeding the animals:",
        "A placa sugere que alimentar os animais:",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "beach-sign",
    skill: "inference",
  },
  {
    content: {
      context: t(
        "Theme: Ways to fight disinformation on social media in Brazil.",
        "Tema: Caminhos para combater a desinformação nas redes sociais no Brasil.",
      ),
      keyPoints: [
        t("A clear thesis in the introduction", "Uma tese clara na introdução"),
        t(
          "Two arguments backed by relevant references",
          "Dois argumentos sustentados por repertório pertinente",
        ),
        t(
          "An intervention proposal with agent, action, means, purpose and a detail",
          "Uma proposta de intervenção com agente, ação, meio, finalidade e detalhamento",
        ),
      ],
      question: t(
        "Write an argumentative essay of up to 30 lines on the theme, in standard written Portuguese, ending with an intervention proposal that respects human rights.",
        "Escreva um texto dissertativo-argumentativo de até 30 linhas sobre o tema, na norma-padrão da língua portuguesa, terminando com uma proposta de intervenção que respeite os direitos humanos.",
      ),
      rubric: [
        {
          criterion: t("C1: Standard written language", "C1: Norma-padrão"),
          description: t(
            "Command of formal written Portuguese.",
            "Domínio da modalidade escrita formal da língua portuguesa.",
          ),
        },
        {
          criterion: t("C2: Theme and genre", "C2: Tema e tipo textual"),
          description: t(
            "Understands the theme and uses knowledge from different areas in an argumentative essay.",
            "Compreende a proposta e usa conhecimentos de várias áreas num texto dissertativo-argumentativo.",
          ),
        },
        {
          criterion: t("C3: Argument", "C3: Argumentação"),
          description: t(
            "Selects, relates and organizes facts and opinions to defend a point of view.",
            "Seleciona, relaciona e organiza fatos e opiniões em defesa de um ponto de vista.",
          ),
        },
        {
          criterion: t("C4: Cohesion", "C4: Coesão"),
          description: t(
            "Uses linking devices to build the argument.",
            "Usa mecanismos linguísticos de coesão para construir a argumentação.",
          ),
        },
        {
          criterion: t("C5: Intervention proposal", "C5: Proposta de intervenção"),
          description: t(
            "Proposes a solution to the problem that respects human rights.",
            "Elabora uma proposta de intervenção para o problema que respeite os direitos humanos.",
          ),
        },
      ],
      sampleOutline: t(
        "Intro: disinformation spreads faster than corrections, and the thesis is that it harms public health and democracy. Argument 1: the 2018 and 2022 elections and false health rumors. Argument 2: platforms profit from engagement, whatever the content. Conclusion: the Ministry of Education adds media literacy to school curricula, through workshops on checking sources, so that young people learn to tell news from rumor.",
        "Introdução: a desinformação se espalha mais rápido que as correções, e a tese é que ela prejudica a saúde pública e a democracia. Argumento 1: as eleições de 2018 e 2022 e os boatos sobre saúde. Argumento 2: as plataformas lucram com engajamento, seja qual for o conteúdo. Conclusão: o Ministério da Educação inclui educação midiática nos currículos, por meio de oficinas de checagem de fontes, para que os jovens aprendam a distinguir notícia de boato.",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "essay",
    key: "essay-disinformation",
    skill: "intervention-proposal",
  },
];
