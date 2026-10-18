import { t } from "../../_utils/localize";
import { skill } from "../content";

/** The overview band: what quantum physics says, without the math. */
export const overviewSkills = [
  skill("atom-scale", "overview", {
    description: t(
      "An atom is about a ten-billionth of a meter across: millions fit side by side in the period at the end of this sentence.",
      "Um átomo mede cerca de um décimo de bilionésimo de metro: milhões cabem lado a lado no ponto final desta frase.",
    ),
    name: t("Picture how small an atom is", "Visualizar o tamanho de um átomo"),
  }),
  skill(
    "quantum-rules",
    "overview",
    {
      description: t(
        "At the scale of atoms, energy comes in steps and particles spread like waves, so everyday intuition stops working.",
        "Na escala dos átomos, a energia vem em degraus e as partículas se espalham como ondas, então a intuição do dia a dia deixa de funcionar.",
      ),
      name: t(
        "Explain why tiny things follow other rules",
        "Explicar por que coisas minúsculas seguem outras regras",
      ),
    },
    { prerequisites: ["atom-scale"] },
  ),
  skill("light-wave", "overview", {
    description: t(
      "Light is a wave, and the distance between its crests, the wavelength, sets its color.",
      "A luz é uma onda, e a distância entre suas cristas, o comprimento de onda, define sua cor.",
    ),
    name: t("Describe light as a wave", "Descrever a luz como onda"),
  }),
  skill(
    "photon",
    "overview",
    {
      description: t(
        "Light carries energy in packets called photons, and a photon's energy decides its color.",
        "A luz carrega energia em pacotes chamados fótons, e a energia de um fóton decide sua cor.",
      ),
      example: t(
        "A violet photon carries about twice the energy of a red one.",
        "Um fóton violeta carrega cerca do dobro da energia de um vermelho.",
      ),
      name: t("Describe light as a stream of photons", "Descrever a luz como um fluxo de fótons"),
    },
    { prerequisites: ["light-wave"] },
  ),
  skill(
    "duality",
    "overview",
    {
      description: t(
        "Light and electrons spread out like waves but always arrive in single spots, like particles.",
        "A luz e os elétrons se espalham como ondas, mas sempre chegam em pontos isolados, como partículas.",
      ),
      name: t("Explain wave-particle duality", "Explicar a dualidade onda-partícula"),
    },
    { prerequisites: ["photon"] },
  ),
  skill(
    "atom-structure",
    "overview",
    {
      description: t(
        "An atom is a tiny, heavy nucleus of protons and neutrons, surrounded by mostly empty space where its electrons are found.",
        "Um átomo é um núcleo minúsculo e pesado, de prótons e nêutrons, cercado de espaço quase vazio onde ficam seus elétrons.",
      ),
      example: t(
        "If the atom were a football stadium, the nucleus would be a marble in the center.",
        "Se o átomo fosse um estádio de futebol, o núcleo seria uma bolinha de gude no centro.",
      ),
      name: t("Describe the parts of an atom", "Descrever as partes de um átomo"),
    },
    { prerequisites: ["atom-scale"] },
  ),
  skill(
    "electron-cloud",
    "overview",
    {
      description: t(
        "The electron isn't a ball on an orbit: it's a cloud that maps where it's likely to be found.",
        "O elétron não é uma bolinha em órbita: é uma nuvem que mapeia onde ele provavelmente está.",
      ),
      example: t(
        "Hydrogen's electron cloud is a fuzzy sphere, thickest near the nucleus.",
        "A nuvem do elétron do hidrogênio é uma esfera difusa, mais densa perto do núcleo.",
      ),
      name: t(
        "Describe the electron as a cloud of chances",
        "Descrever o elétron como uma nuvem de probabilidades",
      ),
      useCase: t(
        "Chemists read electron clouds to predict how atoms bond into molecules.",
        "Químicos leem as nuvens de elétrons para prever como os átomos se ligam em moléculas.",
      ),
    },
    { prerequisites: ["atom-structure"] },
  ),
  skill(
    "ground-state",
    "overview",
    {
      description: t(
        "An atom's lowest energy, the ground state, is a floor: squeezing the electron closer would cost energy, not release it.",
        "A menor energia de um átomo, o estado fundamental, é um piso: apertar o elétron mais perto custaria energia, em vez de liberar.",
      ),
      example: t(
        "In its ground state, hydrogen's electron cloud stays about 0.1 nm across and never shrinks further.",
        "No estado fundamental, a nuvem do elétron do hidrogênio mede cerca de 0,1 nm e nunca encolhe mais.",
      ),
      name: t("Explain why atoms don't collapse", "Explicar por que os átomos não colapsam"),
      useCase: t(
        "Every stable thing around you, from water to your phone, exists because atoms sit in their ground state.",
        "Tudo o que é estável ao seu redor, da água ao seu celular, existe porque os átomos ficam no estado fundamental.",
      ),
    },
    { hard: true, prerequisites: ["electron-cloud"] },
  ),
  skill(
    "confinement",
    "overview",
    {
      description: t(
        "The smaller the space a particle is squeezed into, the more it jitters and the more energy it has.",
        "Quanto menor o espaço em que uma partícula é espremida, mais ela se agita e mais energia ela tem.",
      ),
      name: t(
        "Explain why confinement costs energy",
        "Explicar por que o confinamento custa energia",
      ),
    },
    { prerequisites: ["ground-state"] },
  ),
  skill(
    "emission-lines",
    "overview",
    {
      description: t(
        "Electrons drop between fixed energy steps, and each drop releases a photon whose color matches the size of the drop.",
        "Os elétrons caem entre degraus fixos de energia, e cada queda libera um fóton cuja cor corresponde ao tamanho da queda.",
      ),
      example: t(
        "Salt turns a flame yellow-orange because sodium's favorite drop releases about 2.1 eV.",
        "O sal deixa a chama amarelo-alaranjada porque a queda preferida do sódio libera cerca de 2,1 eV.",
      ),
      name: t(
        "Explain why each element glows in its own colors",
        "Explicar por que cada elemento brilha com suas próprias cores",
      ),
      useCase: t(
        "Astronomers read these colors in starlight to tell what stars are made of.",
        "Astrônomos leem essas cores na luz das estrelas para descobrir do que elas são feitas.",
      ),
    },
    { prerequisites: ["ground-state", "photon"] },
  ),
  skill(
    "photon-wavelength",
    "overview",
    {
      description: t(
        "A photon's wavelength in nanometers is 1240 divided by its energy in electronvolts.",
        "O comprimento de onda de um fóton, em nanômetros, é 1240 dividido pela energia em elétron-volts.",
      ),
      example: t(
        "A 2.55 eV drop gives 1240 ÷ 2.55 ≈ 486 nm: blue-green light.",
        "Uma queda de 2,55 eV dá 1240 ÷ 2,55 ≈ 486 nm: luz azul-esverdeada.",
      ),
      name: t(
        "Work out a photon's wavelength from its energy",
        "Calcular o comprimento de onda de um fóton pela energia",
      ),
      useCase: t(
        "LED makers choose materials whose energy gap gives exactly the color they want.",
        "Fabricantes de LED escolhem materiais cuja diferença de energia dá exatamente a cor que querem.",
      ),
    },
    { hard: true, prerequisites: ["emission-lines", "sci-notation"] },
  ),
  skill(
    "uncertainty",
    "overview",
    {
      description: t(
        "The more precisely you know where a particle is, the less precisely you can know how it's moving.",
        "Quanto mais precisamente você sabe onde uma partícula está, menos precisamente pode saber como ela se move.",
      ),
      name: t("Explain the uncertainty principle", "Explicar o princípio da incerteza"),
    },
    { prerequisites: ["confinement"] },
  ),
  skill(
    "measurement",
    "overview",
    {
      description: t(
        "Measuring a quantum system forces one definite result out of many possible ones.",
        "Medir um sistema quântico força um resultado definido entre vários possíveis.",
      ),
      name: t(
        "Explain how measuring changes a quantum system",
        "Explicar como a medição muda um sistema quântico",
      ),
    },
    { prerequisites: ["uncertainty"] },
  ),
  skill(
    "entanglement",
    "overview",
    {
      description: t(
        "Two entangled particles share one state: measuring one tells you about the other, however far apart they are.",
        "Duas partículas emaranhadas compartilham um estado: medir uma diz algo sobre a outra, por mais longe que estejam.",
      ),
      name: t("Describe entanglement", "Descrever o emaranhamento"),
    },
    { prerequisites: ["measurement"] },
  ),
  skill(
    "no-signaling",
    "overview",
    {
      description: t(
        "Each side of an entangled pair sees random results; the link only shows when the two compare notes.",
        "Cada lado de um par emaranhado vê resultados aleatórios; a ligação só aparece quando os dois comparam as anotações.",
      ),
      name: t(
        "Explain why entanglement can't send messages",
        "Explicar por que o emaranhamento não envia mensagens",
      ),
    },
    { prerequisites: ["entanglement"] },
  ),
  skill(
    "transistors",
    "overview",
    {
      description: t(
        "Chips switch currents with transistors, whose behavior only quantum physics explains.",
        "Os chips ligam e desligam correntes com transistores, cujo funcionamento só a física quântica explica.",
      ),
      name: t(
        "Explain how quantum physics makes chips work",
        "Explicar como a física quântica faz os chips funcionarem",
      ),
    },
    { prerequisites: ["ground-state"] },
  ),
  skill(
    "leds-lasers",
    "overview",
    {
      description: t(
        "LEDs make light when electrons drop across an energy gap; lasers make those photons march in step.",
        "LEDs fazem luz quando elétrons caem através de uma diferença de energia; lasers fazem esses fótons marcharem juntos.",
      ),
      name: t("Explain how LEDs and lasers make light", "Explicar como LEDs e lasers produzem luz"),
    },
    { prerequisites: ["emission-lines"] },
  ),
];
