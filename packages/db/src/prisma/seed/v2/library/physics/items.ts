import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** Practice and review questions for the skills of the written lessons, math as data. */
export const physicsItems: SeedItem[] = [
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("Where the electron is likely to be found", "Onde o elétron provavelmente está"),
          t(
            "The fuzziness is a map of chances: thick where the electron is likely, thin where it's rare.",
            "O borrão é um mapa de probabilidades: denso onde o elétron é provável, ralo onde é raro.",
          ),
        ),
        bankOption(
          t(
            "The electron moving so fast it looks blurred",
            "O elétron se movendo tão rápido que parece borrado",
          ),
          t(
            "There's no tiny ball racing inside. The cloud is all there is until someone measures.",
            "Não há bolinha correndo lá dentro. A nuvem é tudo o que existe até alguém medir.",
          ),
          t(
            "Thinks the cloud is a fast ball smeared by its motion",
            "Acha que a nuvem é uma bolinha rápida borrada pelo movimento",
          ),
        ),
        bankOption(
          t("The electron's actual size", "O tamanho real do elétron"),
          t(
            "The electron has no measurable size; the cloud shows where it may be.",
            "O elétron não tem tamanho mensurável; a nuvem mostra onde ele pode estar.",
          ),
          t(
            "Confuses the cloud with the size of the electron",
            "Confunde a nuvem com o tamanho do elétron",
          ),
        ),
        bankOption(
          t("Many electrons packed together", "Muitos elétrons amontoados"),
          t(
            "Hydrogen has a single electron. The whole cloud belongs to it.",
            "O hidrogênio tem um único elétron. A nuvem inteira é dele.",
          ),
          t(
            "Thinks each part of the cloud is a separate electron",
            "Acha que cada parte da nuvem é um elétron diferente",
          ),
        ),
      ],
      question: t(
        "A chemistry book draws the hydrogen atom as a fuzzy sphere around the nucleus. What does the fuzziness represent?",
        "Um livro de química desenha o átomo de hidrogênio como uma esfera difusa em volta do núcleo. O que esse borrão representa?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "electron-cloud-fuzzy",
    skill: "electron-cloud",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Holds the planet picture of the atom",
        "Mantém a imagem planetária do átomo",
      ),
      reason: t(
        "An orbiting electron would radiate energy and crash in an instant. The electron is a cloud of chances with no path.",
        "Um elétron em órbita irradiaria energia e cairia num instante. O elétron é uma nuvem de probabilidades, sem caminho.",
      ),
      statement: t(
        "In an atom, the electron travels around the nucleus on a fixed path, like a planet around the Sun.",
        "No átomo, o elétron percorre um caminho fixo em volta do núcleo, como um planeta em volta do Sol.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "electron-cloud-orbit",
    skill: "electron-cloud",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "It would go up, because a more confined electron jitters more",
            "Subiria, porque um elétron mais confinado se agita mais",
          ),
          t(
            "Squeezing costs more energy in jitter than the closer pull gives back, so the total rises.",
            "Espremer custa mais energia em agitação do que a atração mais forte devolve, então o total sobe.",
          ),
        ),
        bankOption(
          t(
            "It would go down, because the electron is closer to the nucleus",
            "Desceria, porque o elétron fica mais perto do núcleo",
          ),
          t(
            "The pull does get stronger, but confinement costs even more. That's why the ground state is a floor.",
            "A atração aumenta, mas o confinamento custa ainda mais. Por isso o estado fundamental é um piso.",
          ),
          t(
            "Considers the pull of the nucleus and ignores the cost of confinement",
            "Considera a atração do núcleo e ignora o custo do confinamento",
          ),
        ),
        bankOption(
          t("It would stay the same", "Continuaria igual"),
          t(
            "Changing the size of the cloud always changes the energy; the ground state is the size where it's lowest.",
            "Mudar o tamanho da nuvem sempre muda a energia; o estado fundamental é o tamanho em que ela é mínima.",
          ),
          t(
            "Thinks the energy doesn't depend on how spread out the electron is",
            "Acha que a energia não depende de quão espalhado o elétron está",
          ),
        ),
      ],
      question: t(
        "What would happen to a hydrogen atom's energy if its electron cloud were squeezed to half its size?",
        "O que aconteceria com a energia de um átomo de hidrogênio se a nuvem do elétron fosse espremida para a metade do tamanho?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "ground-state-squeeze",
    skill: "ground-state",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Sodium's electrons mostly make one drop size, which gives yellow-orange light",
            "Os elétrons do sódio fazem principalmente um tamanho de queda, que dá luz amarelo-alaranjada",
          ),
          t(
            "Each color is one drop size, and sodium's strongest drop is about 2.1 eV: yellow-orange.",
            "Cada cor é um tamanho de queda, e a queda mais forte do sódio tem cerca de 2,1 eV: amarelo-alaranjado.",
          ),
        ),
        bankOption(
          t("The lamp's glass is yellow", "O vidro da lâmpada é amarelo"),
          t(
            "The glass is clear. The color is made by the sodium atoms themselves.",
            "O vidro é transparente. A cor é feita pelos próprios átomos de sódio.",
          ),
          t(
            "Thinks the color comes from a filter, not from the atoms",
            "Acha que a cor vem de um filtro, não dos átomos",
          ),
        ),
        bankOption(
          t("Sodium absorbs every other color", "O sódio absorve todas as outras cores"),
          t(
            "Nothing is being filtered: the atoms only make the colors their energy steps allow.",
            "Nada está sendo filtrado: os átomos só fazem as cores que seus degraus de energia permitem.",
          ),
          t("Confuses giving off light with filtering it", "Confunde emitir luz com filtrá-la"),
        ),
      ],
      question: t(
        "Old sodium street lamps glow yellow-orange instead of white. Why?",
        "As antigas lâmpadas de sódio da iluminação pública brilham amarelo-alaranjado em vez de branco. Por quê?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "emission-sodium-lamp",
    skill: "emission-lines",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks brightness sets a photon's energy",
        "Acha que o brilho define a energia do fóton",
      ),
      reason: t(
        "Brighter light has more photons, not stronger ones. Every red photon carries about the same energy; only a bluer color would carry more.",
        "Uma luz mais forte tem mais fótons, não fótons mais fortes. Todo fóton vermelho carrega quase a mesma energia; só uma cor mais azulada carregaria mais.",
      ),
      statement: t(
        "A brighter red light is made of red photons that each carry more energy.",
        "Uma luz vermelha mais forte é feita de fótons vermelhos com mais energia cada um.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "photon-brightness",
    skill: "photon",
  },
  {
    content: {
      context: null,
      math: {
        answer: 486.27,
        commonMistakes: [
          {
            expression: "energy / 1240",
            misconception: t(
              "Divided the energy by 1240 instead of 1240 by the energy",
              "Dividiu a energia por 1240 em vez de 1240 pela energia",
            ),
            reason: t(
              "The shortcut divides 1240 by the energy: a bigger energy has to give a shorter wavelength.",
              "O atalho divide 1240 pela energia: uma energia maior tem que dar um comprimento de onda menor.",
            ),
          },
          {
            expression: "1240 * energy",
            misconception: t("Multiplied instead of dividing", "Multiplicou em vez de dividir"),
            reason: t(
              "Wavelength shrinks as energy grows, so the energy goes below the line.",
              "O comprimento de onda diminui quando a energia aumenta, então a energia vai no denominador.",
            ),
          },
        ],
        solution: "1240 / energy",
        steps: [
          {
            expression: null,
            text: t(
              "Use the shortcut: wavelength in nm = 1240 ÷ energy in eV.",
              "Use o atalho: comprimento de onda em nm = 1240 ÷ energia em eV.",
            ),
          },
          {
            expression: "1240 / energy",
            text: t("1240 ÷ {energy} = {result} nm", "1240 ÷ {energy} = {result} nm"),
          },
        ],
        tolerance: { kind: "absolute", value: 1 },
        unit: "nm",
        variables: [{ max: 3.2, min: 1.7, name: "energy", step: 0.05, unit: "eV", value: 2.55 }],
      },
      question: t(
        "An electron drops by {energy} eV. What is the wavelength of the photon, in nanometers?",
        "Um elétron cai {energy} eV. Qual é o comprimento de onda do fóton, em nanômetros?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "photon-wavelength-from-energy",
    skill: "photon-wavelength",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("3.84 × 10⁸ m", "3,84 × 10⁸ m"),
          t(
            "The point jumps 8 places left from 384,000,000 to 3.84.",
            "A vírgula pula 8 casas para a esquerda, de 384.000.000 até 3,84.",
          ),
        ),
        bankOption(
          t("3.84 × 10⁶ m", "3,84 × 10⁶ m"),
          t(
            "Count the jumps of the point, not the zeros: there are 8 jumps, even though there are 6 zeros.",
            "Conte os pulos da vírgula, não os zeros: são 8 pulos, mesmo com 6 zeros.",
          ),
          t(
            "Counted the zeros instead of the jumps of the decimal point",
            "Contou os zeros em vez dos pulos da vírgula",
          ),
        ),
        bankOption(
          t("384 × 10⁶ m", "384 × 10⁶ m"),
          t(
            "It's the same distance, but in scientific notation the front number must be between 1 and 10.",
            "É a mesma distância, mas na notação científica o número da frente precisa estar entre 1 e 10.",
          ),
          t(
            "Left the front number outside the 1-to-10 range",
            "Deixou o número da frente fora do intervalo de 1 a 10",
          ),
        ),
        bankOption(
          t("3.84 × 10⁻⁸ m", "3,84 × 10⁻⁸ m"),
          t(
            "A negative power makes a tiny number. The Moon is far away, so the power is positive.",
            "Potência negativa faz um número minúsculo. A Lua está longe, então a potência é positiva.",
          ),
          t(
            "Used a negative power for a big number",
            "Usou potência negativa para um número grande",
          ),
        ),
      ],
      question: t(
        "The Moon is about 384,000,000 m from Earth. How is that written in scientific notation?",
        "A Lua fica a cerca de 384.000.000 m da Terra. Como isso fica em notação científica?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "sci-notation-moon",
    skill: "sci-notation",
  },
  {
    content: {
      context: null,
      math: {
        answer: 100_000,
        commonMistakes: [
          {
            expression: "big - small",
            misconception: t(
              "Gave the difference of the powers instead of ten to that power",
              "Deu a diferença das potências em vez de dez elevado a ela",
            ),
            reason: t(
              "Each step in the power is another factor of ten, so a gap of 3 means 10 × 10 × 10.",
              "Cada degrau na potência é mais um fator dez, então uma diferença de 3 quer dizer 10 × 10 × 10.",
            ),
          },
          {
            expression: "big / small",
            misconception: t("Divided the powers", "Dividiu as potências"),
            reason: t(
              "Powers of ten divide by subtracting their exponents, not by dividing them.",
              "Potências de dez se dividem subtraindo os expoentes, não dividindo um pelo outro.",
            ),
          },
        ],
        solution: "10^(big - small)",
        steps: [
          {
            expression: null,
            text: t(
              "The front numbers match, so only the powers differ.",
              "Os números da frente são iguais, então só as potências mudam.",
            ),
          },
          {
            expression: "big - small",
            text: t(
              "Subtract the powers: {big} − {small} = {result}.",
              "Subtraia as potências: {big} − {small} = {result}.",
            ),
          },
          {
            expression: "10^(big - small)",
            text: t(
              "Each step is a factor of ten, so the first is {result} times longer.",
              "Cada degrau é um fator dez, então o primeiro é {result} vezes maior.",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.001 },
        unit: null,
        variables: [
          { max: 9, min: 5, name: "big", step: 1, unit: null, value: 8 },
          { max: 4, min: 1, name: "small", step: 1, unit: null, value: 3 },
        ],
      },
      question: t(
        "One distance is 4 × 10^{big} m and another is 4 × 10^{small} m. How many times longer is the first?",
        "Uma distância é 4 × 10^{big} m e outra é 4 × 10^{small} m. Quantas vezes a primeira é maior?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "orders-of-magnitude-ratio",
    skill: "orders-of-magnitude",
  },
];
