import { t } from "../../_utils/localize";
import { skill } from "../content";

/** The intermediate band: calculus and the classical physics quantum mechanics builds on. */
export const classicalSkills = [
  skill(
    "derivative",
    "intermediate",
    {
      description: t(
        "A derivative is the slope of a curve at one point: how fast something is changing right now.",
        "A derivada é a inclinação de uma curva em um ponto: a rapidez com que algo muda agora.",
      ),
      name: t("Find a rate of change at an instant", "Achar a taxa de variação em um instante"),
    },
    { prerequisites: ["slope"] },
  ),
  skill(
    "derivative-rules",
    "intermediate",
    {
      description: t(
        "The derivative of xⁿ is n·xⁿ⁻¹: the derivative of x³ is 3x².",
        "A derivada de xⁿ é n·xⁿ⁻¹: a derivada de x³ é 3x².",
      ),
      name: t("Differentiate with the power rule", "Derivar com a regra da potência"),
    },
    { prerequisites: ["derivative"] },
  ),
  skill(
    "integral",
    "intermediate",
    {
      description: t(
        "An integral adds up infinitely many thin slices, like the distance covered at a speed that keeps changing.",
        "A integral soma infinitas fatias finas, como a distância percorrida com uma velocidade que muda o tempo todo.",
      ),
      name: t("Find an area under a curve", "Calcular a área sob uma curva"),
    },
    { prerequisites: ["derivative"] },
  ),
  skill(
    "newton-second-law",
    "intermediate",
    {
      description: t(
        "Net force equals mass times acceleration: push twice as hard and the acceleration doubles.",
        "A força resultante é massa vezes aceleração: empurre com o dobro da força e a aceleração dobra.",
      ),
      name: t("Apply F = ma", "Aplicar F = ma"),
    },
    { prerequisites: ["vector-add"] },
  ),
  skill(
    "energy-conservation",
    "intermediate",
    {
      description: t(
        "Energy changes form but its total stays the same: on a slide, height turns into speed.",
        "A energia muda de forma, mas o total continua o mesmo: no escorregador, altura vira velocidade.",
      ),
      name: t("Use conservation of energy", "Usar a conservação da energia"),
    },
    { prerequisites: ["newton-second-law"] },
  ),
  skill(
    "wave-equation",
    "intermediate",
    {
      description: t(
        "A wave's speed is its wavelength times its frequency: v = λf.",
        "A velocidade de uma onda é o comprimento de onda vezes a frequência: v = λf.",
      ),
      name: t(
        "Relate speed, wavelength and frequency",
        "Relacionar velocidade, comprimento de onda e frequência",
      ),
    },
    { prerequisites: ["function-concept"] },
  ),
  skill(
    "interference",
    "intermediate",
    {
      description: t(
        "Overlapping waves add up: crest on crest grows, crest on trough cancels.",
        "Ondas que se sobrepõem se somam: crista com crista cresce, crista com vale se anula.",
      ),
      name: t("Predict interference", "Prever a interferência"),
    },
    { prerequisites: ["wave-equation"] },
  ),
  skill(
    "electric-field",
    "intermediate",
    {
      description: t(
        "A charge creates a field around it that pushes or pulls other charges.",
        "Uma carga cria um campo ao seu redor que empurra ou puxa outras cargas.",
      ),
      name: t("Describe an electric field", "Descrever um campo elétrico"),
    },
    { prerequisites: ["vector-concept"] },
  ),
  skill(
    "em-wave",
    "intermediate",
    {
      description: t(
        "Light is electric and magnetic fields waving together, traveling at 300,000 km per second.",
        "A luz é feita de campos elétricos e magnéticos oscilando juntos, a 300 mil km por segundo.",
      ),
      name: t(
        "Explain light as an electromagnetic wave",
        "Explicar a luz como onda eletromagnética",
      ),
    },
    { prerequisites: ["electric-field", "wave-equation"] },
  ),
];

/** The advanced band: quantum mechanics with its math. */
export const quantumSkills = [
  skill(
    "born-rule",
    "advanced",
    {
      description: t(
        "The square of the wave function, |ψ|², gives the chance of finding the particle in each place.",
        "O quadrado da função de onda, |ψ|², dá a chance de encontrar a partícula em cada lugar.",
      ),
      name: t("Get probabilities from the wave function", "Tirar probabilidades da função de onda"),
    },
    { prerequisites: ["duality", "integral"] },
  ),
  skill(
    "superposition",
    "advanced",
    {
      description: t(
        "Before it's measured, a quantum system can be in a combination of states at once.",
        "Antes de ser medido, um sistema quântico pode estar em uma combinação de estados ao mesmo tempo.",
      ),
      name: t("Describe superposition", "Descrever a superposição"),
    },
    { prerequisites: ["born-rule"] },
  ),
  skill(
    "particle-in-box",
    "advanced",
    {
      description: t(
        "A particle trapped in a box can only have energies proportional to n²: 1, 4, 9 and so on.",
        "Uma partícula presa em uma caixa só pode ter energias proporcionais a n²: 1, 4, 9 e assim por diante.",
      ),
      name: t(
        "Find the energy levels of a particle in a box",
        "Achar os níveis de energia de uma partícula na caixa",
      ),
    },
    { prerequisites: ["born-rule", "confinement"] },
  ),
  skill(
    "hydrogen-levels",
    "advanced",
    {
      description: t(
        "Hydrogen's electron can only have energies of −13.6 eV divided by n².",
        "O elétron do hidrogênio só pode ter energias de −13,6 eV divididos por n².",
      ),
      name: t("Find hydrogen's energy levels", "Achar os níveis de energia do hidrogênio"),
    },
    { prerequisites: ["particle-in-box"] },
  ),
  skill(
    "spin",
    "advanced",
    {
      description: t(
        "Spin is a built-in angular momentum: measured along any axis, an electron's comes out only up or down.",
        "O spin é um momento angular próprio: medido em qualquer eixo, o do elétron só dá para cima ou para baixo.",
      ),
      name: t("Describe spin", "Descrever o spin"),
    },
    { prerequisites: ["superposition"] },
  ),
  skill(
    "qubit",
    "advanced",
    {
      description: t(
        "A qubit holds a superposition of 0 and 1; measuring it gives one or the other.",
        "Um qubit guarda uma superposição de 0 e 1; medi-lo dá um ou outro.",
      ),
      name: t("Describe a qubit", "Descrever um qubit"),
    },
    { prerequisites: ["superposition", "spin"] },
  ),
  skill(
    "bell-test",
    "advanced",
    {
      description: t(
        "Experiments show entangled particles agree more often than any plan set in advance could explain.",
        "Experimentos mostram que partículas emaranhadas concordam mais do que qualquer plano combinado de antemão explicaria.",
      ),
      name: t("Explain what Bell tests showed", "Explicar o que os testes de Bell mostraram"),
    },
    { prerequisites: ["entanglement", "qubit"] },
  ),
];
