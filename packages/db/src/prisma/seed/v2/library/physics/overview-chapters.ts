import { t } from "../../_utils/localize";
import { outlineLesson } from "../content";
import { type SeedChapter } from "../types";
import { electronCloudLesson } from "./lessons/electron-cloud";
import { whyColorsExistLesson } from "./lessons/why-colors-exist";

/** The overview band: the ideas of quantum physics for anyone curious, in six chapters. */
export const overviewChapters: SeedChapter[] = [
  {
    description: t(
      "How small atoms are, and why things that small play by different rules.",
      "Quão pequenos são os átomos, e por que coisas tão pequenas seguem outras regras.",
    ),
    key: "very-small-world",
    lessons: [
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
