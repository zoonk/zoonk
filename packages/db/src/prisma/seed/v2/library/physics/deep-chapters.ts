import { t } from "../../_utils/localize";
import { outlineLesson } from "../content";
import { type SeedChapter } from "../types";

/** The intermediate band: calculus and classical physics, which quantum mechanics builds on. */
export const classicalChapters: SeedChapter[] = [
  {
    description: t(
      "How fast things change, at any instant.",
      "A rapidez com que as coisas mudam, em qualquer instante.",
    ),
    key: "derivatives",
    lessons: [
      outlineLesson(
        "rate-at-an-instant",
        {
          description: t("A speedometer shows a derivative.", "O velocímetro mostra uma derivada."),
          title: t("The rate at an instant", "A taxa em um instante"),
        },
        ["derivative"],
        5,
      ),
      outlineLesson(
        "power-rule",
        {
          description: t(
            "One rule that differentiates most of what physics needs.",
            "Uma regra que deriva quase tudo de que a física precisa.",
          ),
          title: t("The power rule", "A regra da potência"),
        },
        ["derivative-rules"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t("Find rates of change with derivatives", "Achar taxas de variação com derivadas"),
    ],
    title: t("Derivatives", "Derivadas"),
  },
  {
    description: t(
      "Adding up tiny pieces to get a whole.",
      "Somar pedaços minúsculos para chegar ao todo.",
    ),
    key: "integrals",
    lessons: [
      outlineLesson(
        "area-under-a-curve",
        {
          description: t(
            "Distance is the area under a speed graph.",
            "A distância é a área sob o gráfico da velocidade.",
          ),
          title: t("Adding up tiny pieces", "Somando pedaços minúsculos"),
        },
        ["integral"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t("Find areas under curves with integrals", "Calcular áreas sob curvas com integrais"),
    ],
    title: t("Integrals", "Integrais"),
  },
  {
    description: t(
      "Newton's laws and the energy that never disappears.",
      "As leis de Newton e a energia que nunca desaparece.",
    ),
    key: "motion-forces",
    lessons: [
      outlineLesson(
        "force-mass-acceleration",
        {
          description: t(
            "Why an empty cart is easier to push than a full one.",
            "Por que um carrinho vazio é mais fácil de empurrar que um cheio.",
          ),
          title: t("Force, mass and acceleration", "Força, massa e aceleração"),
        },
        ["newton-second-law"],
      ),
      outlineLesson(
        "energy-never-disappears",
        {
          description: t(
            "Height becomes speed, speed becomes heat.",
            "Altura vira velocidade, velocidade vira calor.",
          ),
          title: t("Energy never disappears", "A energia nunca desaparece"),
        },
        ["energy-conservation"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t("Apply Newton's second law", "Aplicar a segunda lei de Newton"),
      t("Use conservation of energy", "Usar a conservação da energia"),
    ],
    title: t("Motion and forces", "Movimento e forças"),
  },
  {
    description: t(
      "What all waves share, from sound to light.",
      "O que todas as ondas têm em comum, do som à luz.",
    ),
    key: "waves",
    lessons: [
      outlineLesson(
        "wave-anatomy",
        {
          description: t(
            "Wavelength, frequency and speed in one equation.",
            "Comprimento de onda, frequência e velocidade numa equação.",
          ),
          title: t(
            "Wavelength, frequency and speed",
            "Comprimento de onda, frequência e velocidade",
          ),
        },
        ["wave-equation"],
      ),
      outlineLesson(
        "when-waves-meet",
        {
          description: t(
            "Why noise-canceling headphones work.",
            "Por que os fones com cancelamento de ruído funcionam.",
          ),
          title: t("When waves meet", "Quando as ondas se encontram"),
        },
        ["interference"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t(
        "Relate a wave's speed, wavelength and frequency",
        "Relacionar velocidade, comprimento de onda e frequência",
      ),
      t("Predict where waves add up or cancel", "Prever onde as ondas se somam ou se anulam"),
    ],
    title: t("Waves", "Ondas"),
  },
  {
    description: t(
      "Charges, fields and the discovery that light is electromagnetic.",
      "Cargas, campos e a descoberta de que a luz é eletromagnética.",
    ),
    key: "electricity-magnetism",
    lessons: [
      outlineLesson(
        "charges-and-fields",
        {
          description: t(
            "How a charge reaches across empty space.",
            "Como uma carga age através do espaço vazio.",
          ),
          title: t("Charges and fields", "Cargas e campos"),
        },
        ["electric-field"],
        5,
      ),
      outlineLesson(
        "light-is-electromagnetic",
        {
          description: t(
            "Maxwell's equations predicted light's speed.",
            "As equações de Maxwell previram a velocidade da luz.",
          ),
          title: t("Light is an electromagnetic wave", "A luz é uma onda eletromagnética"),
        },
        ["em-wave"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t("Describe electric fields", "Descrever campos elétricos"),
      t("Explain light as an electromagnetic wave", "Explicar a luz como onda eletromagnética"),
    ],
    title: t("Electricity and magnetism", "Eletricidade e magnetismo"),
  },
];

/** The advanced band: quantum mechanics with its math, the end of a from-scratch plan. */
export const quantumChapters: SeedChapter[] = [
  {
    description: t(
      "The wave function and the probabilities it holds.",
      "A função de onda e as probabilidades que ela guarda.",
    ),
    key: "wave-function",
    lessons: [
      outlineLesson(
        "probability-from-psi",
        {
          description: t(
            "Square the wave function to get a map of chances.",
            "Eleve a função de onda ao quadrado e tenha um mapa de probabilidades.",
          ),
          title: t("Probability from ψ", "Probabilidade a partir de ψ"),
        },
        ["born-rule"],
        6,
      ),
      outlineLesson(
        "superposition",
        {
          description: t(
            "Being in several states until someone looks.",
            "Estar em vários estados até alguém olhar.",
          ),
          title: t("Superposition", "Superposição"),
        },
        ["superposition"],
        5,
      ),
    ],
    level: "advanced",
    objectives: [
      t("Read probabilities from a wave function", "Ler probabilidades de uma função de onda"),
      t("Describe superposition", "Descrever a superposição"),
    ],
    title: t("The wave function", "A função de onda"),
  },
  {
    description: t(
      "The equation behind every energy level.",
      "A equação por trás de cada nível de energia.",
    ),
    key: "schrodinger-equation",
    lessons: [
      outlineLesson(
        "particle-in-a-box",
        {
          description: t(
            "The simplest system where energy comes in steps.",
            "O sistema mais simples em que a energia vem em degraus.",
          ),
          title: t("A particle in a box", "Uma partícula na caixa"),
        },
        ["particle-in-box"],
        6,
      ),
      outlineLesson(
        "hydrogen-atom",
        {
          description: t(
            "Where hydrogen's staircase of energies comes from.",
            "De onde vem a escada de energias do hidrogênio.",
          ),
          title: t("The hydrogen atom", "O átomo de hidrogênio"),
        },
        ["hydrogen-levels"],
        6,
      ),
    ],
    level: "advanced",
    objectives: [
      t("Solve the particle in a box", "Resolver a partícula na caixa"),
      t("Find hydrogen's energy levels", "Achar os níveis de energia do hidrogênio"),
    ],
    title: t("The Schrödinger equation", "A equação de Schrödinger"),
  },
  {
    description: t(
      "A property with no everyday twin: only up or down.",
      "Uma propriedade sem par no cotidiano: só para cima ou para baixo.",
    ),
    key: "spin",
    lessons: [
      outlineLesson(
        "up-or-down",
        {
          description: t(
            "The experiment that split a beam of silver atoms in two.",
            "O experimento que dividiu um feixe de átomos de prata em dois.",
          ),
          title: t("Up or down", "Para cima ou para baixo"),
        },
        ["spin"],
        5,
      ),
    ],
    level: "advanced",
    objectives: [t("Describe spin and how it's measured", "Descrever o spin e como ele é medido")],
    title: t("Spin", "Spin"),
  },
  {
    description: t(
      "Qubits, entanglement and the experiments that settled a debate.",
      "Qubits, emaranhamento e os experimentos que encerraram um debate.",
    ),
    key: "quantum-computing",
    lessons: [
      outlineLesson(
        "qubits",
        {
          description: t(
            "A bit that can be 0 and 1 until it's read.",
            "Um bit que pode ser 0 e 1 até ser lido.",
          ),
          title: t("Qubits", "Qubits"),
        },
        ["qubit"],
        5,
      ),
      outlineLesson(
        "bell-tests",
        {
          description: t(
            "How experiments ruled out a hidden plan.",
            "Como experimentos descartaram um plano escondido.",
          ),
          title: t("Bell's test", "O teste de Bell"),
        },
        ["bell-test"],
        6,
      ),
    ],
    level: "advanced",
    objectives: [
      t("Describe a qubit", "Descrever um qubit"),
      t("Explain what Bell tests showed", "Explicar o que os testes de Bell mostraram"),
    ],
    title: t("Entanglement and quantum computing", "Emaranhamento e computação quântica"),
    tools: [{ essential: false, name: t("Python", "Python") }],
  },
];
