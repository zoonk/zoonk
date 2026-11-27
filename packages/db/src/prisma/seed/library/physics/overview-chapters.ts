import { t } from "../../_utils/localize";
import { outlineLesson, withPractice } from "../content";
import { type SeedChapter } from "../types";
import { electronCloudLesson } from "./lessons/electron-cloud";
import { whyColorsExistLesson } from "./lessons/why-colors-exist";

export const overviewChapters: SeedChapter[] = [
  {
    description: t(
      "How small atoms are, and why things that small play by different rules.",
      "Quão pequenos são os átomos, e por que coisas tão pequenas seguem outras regras.",
    ),
    key: "very-small-world",
    lessons: [
      withPractice(
        outlineLesson(
          "how-small-is-an-atom",
          {
            description: t(
              "Millions of atoms fit in the period at the end of this sentence.",
              "Milhões de átomos cabem no ponto final desta frase.",
            ),
            title: t("How small is an atom?", "Quão pequeno é um átomo?"),
          },
          ["atom-scale"],
        ),
        {
          answer: t("20", "20"),
          correction: t(
            "Two would span only about 0.2 nm. Divide the distance by the width of one atom.",
            "Dois ocupariam só cerca de 0,2 nm. Divida a distância pela largura de um átomo.",
          ),
          distractor: t("2", "2"),
          example: t(
            "Imagine lining up atoms that each measure 0.1 nanometers across. Ten of them side by side span one nanometer.",
            "Imagine alinhar átomos de 0,1 nanômetro de diâmetro. Dez deles lado a lado ocupam um nanômetro.",
          ),
          question: t(
            "About how many fit across 2 nanometers?",
            "Quantos cabem em cerca de 2 nanômetros?",
          ),
          reason: t(
            "Each nanometer holds about ten, so two hold about twenty.",
            "Cada nanômetro comporta cerca de dez, então em dois cabem cerca de vinte.",
          ),
          takeaway: t(
            "Estimate how many atoms fit by comparing lengths in the same unit.",
            "Para estimar quantos átomos cabem, compare comprimentos na mesma unidade.",
          ),
        },
      ),
      withPractice(
        outlineLesson(
          "rules-change-when-small",
          {
            description: t(
              "Why a ball and an electron can't be described the same way.",
              "Por que uma bola e um elétron não podem ser descritos do mesmo jeito.",
            ),
            title: t(
              "Why small things follow other rules",
              "Por que coisas pequenas seguem outras regras",
            ),
          },
          ["quantum-rules"],
          5,
        ),
        {
          answer: t("The distribution of landing spots", "A distribuição dos pontos de chegada"),
          correction: t(
            "Even when the preparation is identical, successive electrons can arrive at different spots.",
            "Mesmo com preparação idêntica, elétrons sucessivos podem chegar a pontos diferentes.",
          ),
          distractor: t("The exact spot for each electron", "O ponto exato de cada elétron"),
          example: t(
            "A rolling marble follows a path. For an electron prepared in the same way many times, quantum theory predicts how often each landing spot will occur.",
            "Uma bolinha de gude segue uma trajetória. Para um elétron preparado da mesma forma várias vezes, a teoria quântica prevê com que frequência ele chega a cada região.",
          ),
          question: t(
            "What can you predict for many such electrons?",
            "O que dá para prever para muitos elétrons assim?",
          ),
          reason: t(
            "Individual arrivals can vary while their frequencies follow a pattern.",
            "Os pontos de chegada variam, mas suas frequências seguem um padrão.",
          ),
          takeaway: t(
            "Quantum predictions give probabilities for measurement outcomes.",
            "As previsões quânticas dão probabilidades para os resultados de uma medição.",
          ),
        },
      ),
    ],
    level: "overview",
    objectives: [
      t("Picture the size of an atom", "Visualizar o tamanho de um átomo"),
      t("Say what changes at the scale of atoms", "Dizer o que muda na escala dos átomos"),
    ],
    title: t("A very small world", "Um mundo muito pequeno"),
  },
  {
    description: t(
      "Light spreads like a wave and arrives in packets. Both are true.",
      "A luz se espalha como onda e chega em pacotes. As duas coisas são verdade.",
    ),
    key: "light-wave-or-particle",
    lessons: [
      withPractice(
        outlineLesson(
          "light-as-wave",
          {
            description: t(
              "Color is the distance between the crests of a light wave.",
              "A cor é a distância entre as cristas de uma onda de luz.",
            ),
            title: t("Light behaves like a wave", "A luz se comporta como onda"),
          },
          ["light-wave"],
        ),
        {
          answer: t("The spot darkens", "O ponto escurece"),
          correction: t(
            "Crests reinforce other crests. A trough offsets a crest of the same height.",
            "Cristas reforçam outras cristas. Um vale compensa uma crista de mesma altura.",
          ),
          distractor: t("The spot brightens", "O ponto clareia"),
          example: t(
            "Two light waves reach the same spot. When the crest of one meets the crest of the other, their amplitudes add and the spot looks brighter.",
            "Duas ondas de luz chegam ao mesmo ponto. Quando duas cristas se encontram, suas amplitudes se somam e o ponto fica mais claro.",
          ),
          question: t(
            "What happens when a crest meets an equal trough?",
            "O que acontece quando uma crista encontra um vale de mesma amplitude?",
          ),
          reason: t(
            "Opposite displacements cancel. This is destructive interference.",
            "Deslocamentos opostos se cancelam. É a interferência destrutiva.",
          ),
          takeaway: t(
            "Light waves can reinforce or cancel each other where they meet.",
            "Ondas de luz podem se reforçar ou se cancelar onde se encontram.",
          ),
        },
      ),
      withPractice(
        outlineLesson(
          "light-comes-in-packets",
          {
            description: t(
              "Why a dim violet light can do what a bright red one can't.",
              "Por que uma luz violeta fraca consegue o que uma vermelha forte não consegue.",
            ),
            title: t("Light comes in packets", "A luz vem em pacotes"),
          },
          ["photon"],
          5,
        ),
        {
          answer: t("More photons per second", "Mais fótons por segundo"),
          correction: t(
            "Increasing the energy per photon would change the frequency of the light.",
            "Aumentar a energia por fóton mudaria a frequência da luz.",
          ),
          distractor: t("More energy per photon", "Mais energia por fóton"),
          example: t(
            "A detector registers light one photon at a time. At a fixed frequency, each photon carries the same energy.",
            "Um detector registra a luz um fóton por vez. Para uma frequência fixa, cada fóton carrega a mesma energia.",
          ),
          question: t(
            "A red lamp gets brighter without changing color. What reaches the detector?",
            "Uma lâmpada vermelha fica mais brilhante sem mudar de cor. O que chega ao detector?",
          ),
          reason: t(
            "The color fixes the frequency and the energy per photon. Brightness can rise through the number arriving.",
            "A cor determina a frequência e a energia por fóton. O brilho pode aumentar com a quantidade de fótons que chegam.",
          ),
          takeaway: t(
            "At one frequency, more light means more photons.",
            "Para uma mesma frequência, mais luz significa mais fótons.",
          ),
        },
      ),
      withPractice(
        outlineLesson(
          "double-slit",
          {
            description: t(
              "One experiment where light is a wave and a particle at the same time.",
              "Um experimento em que a luz é onda e partícula ao mesmo tempo.",
            ),
            title: t("The double-slit experiment", "O experimento da fenda dupla"),
          },
          ["duality"],
          5,
        ),
        {
          answer: t("After many detections", "Depois de muitas detecções"),
          correction: t(
            "A single detection marks only a spot. You need many spots to see where arrivals concentrate.",
            "Uma detecção marca apenas um ponto. São necessários muitos pontos para ver onde as chegadas se concentram.",
          ),
          distractor: t("In the mark of one photon", "Na marca de um único fóton"),
          example: t(
            "Send photons one at a time toward two open slits. Each marks a single spot on the screen. After many arrivals, bright and dark bands emerge.",
            "Envie fótons um por vez em direção a duas fendas abertas. Cada um marca um ponto na tela. Depois de muitas chegadas, aparecem faixas claras e escuras.",
          ),
          question: t(
            "When does the band pattern become visible?",
            "Quando o padrão de faixas fica visível?",
          ),
          reason: t(
            "Each arrival makes one dot. The interference pattern is in the distribution of many dots.",
            "Cada chegada produz um ponto. O padrão de interferência está na distribuição de muitos pontos.",
          ),
          takeaway: t(
            "Individual detections accumulate into an interference pattern.",
            "As detecções individuais se acumulam até formar um padrão de interferência.",
          ),
        },
      ),
    ],
    level: "overview",
    objectives: [
      t("Describe light as a wave and as photons", "Descrever a luz como onda e como fótons"),
      t(
        "Explain what the double-slit experiment shows",
        "Explicar o que o experimento da fenda dupla mostra",
      ),
    ],
    title: t("Light: wave or particle?", "Luz: onda ou partícula?"),
  },
  {
    description: t(
      "What an atom is made of, why it doesn't collapse and where colors come from.",
      "Do que um átomo é feito, por que ele não colapsa e de onde vêm as cores.",
    ),
    key: "inside-the-atom",
    lessons: [
      withPractice(
        outlineLesson(
          "almost-empty-atom",
          {
            description: t(
              "If an atom were a stadium, its nucleus would be a marble.",
              "Se um átomo fosse um estádio, o núcleo seria uma bolinha de gude.",
            ),
            title: t("An almost empty atom", "Um átomo quase vazio"),
          },
          ["atom-structure"],
          5,
        ),
        {
          answer: t("The region around the nucleus", "A região em volta do núcleo"),
          correction: t(
            "The nucleus dominates the mass. Its size is tiny compared with the region occupied by electrons.",
            "O núcleo concentra a massa. Seu tamanho é minúsculo em relação à região ocupada pelos elétrons.",
          ),
          distractor: t("The nucleus itself", "O próprio núcleo"),
          example: t(
            "Imagine enlarging an atom until its nucleus is a bead at the center of a stadium. The electrons occupy the surrounding region, while almost all the mass sits in the bead.",
            "Imagine ampliar um átomo até que o núcleo seja uma miçanga no centro de um estádio. Os elétrons ocupam a região em volta, mas quase toda a massa está na miçanga.",
          ),
          question: t(
            "Which part accounts for most of the atom’s volume?",
            "Qual parte ocupa a maior parte do volume do átomo?",
          ),
          reason: t(
            "The nucleus contains most of the mass in a tiny fraction of the volume.",
            "O núcleo concentra quase toda a massa em uma fração minúscula do volume.",
          ),
          takeaway: t(
            "An atom’s mass and volume are concentrated in different places.",
            "A massa e o volume de um átomo se concentram em regiões diferentes.",
          ),
        },
      ),
      electronCloudLesson,
      outlineLesson(
        "confined-jittery",
        {
          description: t(
            "Squeeze a particle into less space and it jitters more.",
            "Esprema uma partícula num espaço menor e ela se agita mais.",
          ),
          title: t("More confined, more jittery", "Mais confinado, mais agitado"),
        },
        ["confinement"],
        6,
      ),
      whyColorsExistLesson,
    ],
    level: "overview",
    objectives: [
      t("Describe the parts of an atom", "Descrever as partes de um átomo"),
      t("Explain why atoms don't collapse", "Explicar por que os átomos não colapsam"),
      t("Explain where the colors of light come from", "Explicar de onde vêm as cores da luz"),
    ],
    title: t("Inside the atom", "Dentro do átomo"),
  },
  {
    description: t(
      "Why you can't know everything about a particle at once, and what measuring does.",
      "Por que não dá para saber tudo sobre uma partícula ao mesmo tempo, e o que a medição faz.",
    ),
    key: "uncertainty",
    lessons: [
      outlineLesson(
        "position-momentum",
        {
          description: t(
            "Pin down where a particle is and its motion gets blurry.",
            "Crave onde uma partícula está e o movimento dela fica borrado.",
          ),
          title: t("You can't pin down both", "Não dá para cravar os dois"),
        },
        ["uncertainty"],
        5,
      ),
      outlineLesson(
        "measurement-changes",
        {
          description: t(
            "A measurement picks one result out of many possible ones.",
            "Uma medição escolhe um resultado entre vários possíveis.",
          ),
          title: t("Measuring changes what you measure", "Medir muda o que você mede"),
        },
        ["measurement"],
        5,
      ),
    ],
    level: "overview",
    objectives: [
      t("Explain the uncertainty principle", "Explicar o princípio da incerteza"),
      t("Describe what a measurement does", "Descrever o que uma medição faz"),
    ],
    title: t("Uncertainty", "Incerteza"),
  },
  {
    description: t(
      "Two particles that share one story, however far apart they are.",
      "Duas partículas que compartilham uma história, por mais longe que estejam.",
    ),
    key: "entanglement",
    lessons: [
      outlineLesson(
        "linked-particles",
        {
          description: t(
            "Measure one particle and you know something about its partner.",
            "Meça uma partícula e você sabe algo sobre a parceira dela.",
          ),
          title: t("Two particles, one story", "Duas partículas, uma história"),
        },
        ["entanglement"],
        5,
      ),
      outlineLesson(
        "no-faster-than-light",
        {
          description: t(
            "Entanglement is real, but it can't carry a message.",
            "O emaranhamento é real, mas não carrega mensagens.",
          ),
          title: t("Why it can't send messages", "Por que não dá para mandar mensagens"),
        },
        ["no-signaling"],
        5,
      ),
    ],
    level: "overview",
    objectives: [
      t("Describe entanglement", "Descrever o emaranhamento"),
      t("Explain why it can't send messages", "Explicar por que ele não envia mensagens"),
    ],
    title: t("Entanglement", "Emaranhamento"),
  },
  {
    description: t(
      "The quantum physics inside chips, LEDs and lasers.",
      "A física quântica dentro de chips, LEDs e lasers.",
    ),
    key: "in-your-phone",
    lessons: [
      outlineLesson(
        "transistors",
        {
          description: t(
            "Billions of tiny switches that only quantum physics explains.",
            "Bilhões de chaves minúsculas que só a física quântica explica.",
          ),
          title: t("Transistors and chips", "Transistores e chips"),
        },
        ["transistors"],
        5,
      ),
      outlineLesson(
        "lasers-leds",
        {
          description: t(
            "How an energy gap becomes the light of your screen.",
            "Como uma diferença de energia vira a luz da sua tela.",
          ),
          title: t("LEDs and lasers", "LEDs e lasers"),
        },
        ["leds-lasers"],
      ),
    ],
    level: "overview",
    objectives: [
      t(
        "Explain how transistors depend on quantum physics",
        "Explicar como os transistores dependem da física quântica",
      ),
      t("Explain how LEDs and lasers make light", "Explicar como LEDs e lasers produzem luz"),
    ],
    title: t("Quantum in your phone", "O quântico no seu celular"),
  },
];
