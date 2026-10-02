import { t } from "../../../_utils/localize";
import { option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Chapter "Inside the atom", lesson 4. Builds on the energy staircase from the electron lesson:
 * a drop between steps becomes a photon, the size of the drop becomes its color, and one
 * division turns an energy into a wavelength the learner can check on a slider.
 */
export const whyColorsExistLesson: SeedLesson = {
  canDo: t(
    "You'll explain why fireworks come in different colors and work out a light's color from an energy jump.",
    "Você vai explicar por que os fogos de artifício têm cores diferentes e calcular a cor de uma luz a partir de um salto de energia.",
  ),
  description: t(
    "Every element glows in its own colors. The energy staircase inside the atom explains why.",
    "Cada elemento brilha com suas próprias cores. A escada de energia dentro do átomo explica por quê.",
  ),
  key: "why-colors-exist",
  minutes: 6,
  skills: ["emission-lines", "photon-wavelength"],
  steps: [
    {
      content: {
        text: t(
          "Sprinkle table salt into a gas flame and it flashes yellow-orange. Copper turns a flame green, strontium turns it red: that's how fireworks get their colors.\n\nEvery element glows in its own set of colors, as unique as a fingerprint. Astronomers read them in starlight to learn what stars are made of without ever going there.",
          "Jogue sal de cozinha numa chama de fogão e ela fica amarelo-alaranjada. O cobre deixa a chama verde, o estrôncio deixa vermelha: é assim que os fogos de artifício ganham cor.\n\nCada elemento brilha com seu próprio conjunto de cores, único como uma impressão digital. Astrônomos leem essas cores na luz das estrelas para saber do que elas são feitas sem nunca ir até lá.",
        ),
        variant: "text",
      },
      kind: "hook",
    },
    {
      content: {
        text: t(
          "The electron in an atom can only have certain energies, like the steps of a staircase. Heat the atom and the electron gets kicked up to a higher step.\n\nIt doesn't stay there. It drops back down, and the energy it loses leaves as a tiny packet of light: a **photon**.",
          "O elétron de um átomo só pode ter certas energias, como os degraus de uma escada. Aqueça o átomo e o elétron é chutado para um degrau mais alto.\n\nEle não fica lá. Ele cai de volta, e a energia que perde sai como um pacotinho de luz: um **fóton**.",
        ),
        title: t("Energy comes in steps", "A energia vem em degraus"),
      },
      kind: "explanation",
      skill: "emission-lines",
    },
    {
      content: {
        text: t(
          "Each drop releases exactly the energy between the two steps, no more and no less. And a photon's energy decides its color: small drops give red light, bigger ones green, bigger still blue and violet.\n\nEvery element has its own staircase, so it can only make its own set of colors. That's the fingerprint.",
          "Cada queda libera exatamente a energia entre os dois degraus, nem mais nem menos. E a energia do fóton decide a cor: quedas pequenas dão luz vermelha, maiores dão verde, maiores ainda dão azul e violeta.\n\nCada elemento tem sua própria escada, então só consegue fazer o seu conjunto de cores. Essa é a impressão digital.",
        ),
        title: t("The size of the drop is the color", "O tamanho da queda é a cor"),
      },
      kind: "explanation",
      skill: "emission-lines",
    },
    {
      content: {
        options: [
          option(
            "red",
            t("The drop that made red light", "A queda que fez luz vermelha"),
            t(
              "Red is the low-energy end of visible light, so the red drop was the smaller one.",
              "O vermelho é a ponta de menor energia da luz visível, então a queda vermelha foi a menor.",
            ),
          ),
          option(
            "violet",
            t("The drop that made violet light", "A queda que fez luz violeta"),
            t(
              "Violet photons carry the most energy in visible light, so they come from the bigger drop.",
              "Os fótons violeta carregam a maior energia da luz visível, então vêm da queda maior.",
            ),
            true,
          ),
          option(
            "same",
            t(
              "Both were the same size; the color comes from the temperature",
              "As duas foram iguais; a cor vem da temperatura",
            ),
            t(
              "Temperature decides how many electrons get kicked up, not the size of each drop. The color comes from the drop itself.",
              "A temperatura decide quantos elétrons são chutados para cima, não o tamanho de cada queda. A cor vem da própria queda.",
            ),
          ),
        ],
        question: t(
          "In one hydrogen atom, a drop gives off red light. Another drop in the same kind of atom gives off violet light. Which drop was bigger?",
          "Num átomo de hidrogênio, uma queda emite luz vermelha. Outra queda, no mesmo tipo de átomo, emite luz violeta. Qual queda foi maior?",
        ),
      },
      kind: "check",
      skill: "emission-lines",
    },
    {
      content: {
        problem: t(
          "In hydrogen, the electron drops from step 3 to step 2 and loses **1.89 electronvolts** (eV). What color is the light?",
          "No hidrogênio, o elétron cai do degrau 3 para o degrau 2 e perde **1,89 elétron-volt** (eV). Qual é a cor da luz?",
        ),
        result: t(
          "Red, at 656 nm. It's the red glow of hydrogen that astronomers photograph in nebulas.",
          "Vermelha, em 656 nm. É o brilho vermelho do hidrogênio que os astrônomos fotografam nas nebulosas.",
        ),
        steps: [
          {
            math: String.raw`\lambda\ (\text{nm}) = \dfrac{1240}{E\ (\text{eV})}`,
            text: t(
              "Physicists use a shortcut for light: the wavelength in nanometers is 1240 divided by the energy in eV.",
              "Os físicos usam um atalho para a luz: o comprimento de onda em nanômetros é 1240 dividido pela energia em eV.",
            ),
          },
          {
            math: t(
              String.raw`\lambda = \dfrac{1240}{1.89}`,
              String.raw`\lambda = \dfrac{1240}{1{,}89}`,
            ),
            text: t("Put in the energy of this drop.", "Coloque a energia desta queda."),
          },
          { math: String.raw`\lambda \approx 656\ \text{nm}`, text: t("Divide.", "Divida.") },
          {
            math: String.raw`380 < 656 < 750`,
            text: t(
              "Visible light runs from about 380 nm (violet) to 750 nm (red), so 656 nm sits near the red end.",
              "A luz visível vai de cerca de 380 nm (violeta) a 750 nm (vermelho), então 656 nm fica perto da ponta vermelha.",
            ),
          },
        ],
        title: t("From an energy drop to a color", "De uma queda de energia a uma cor"),
      },
      kind: "workedExample",
      skill: "photon-wavelength",
    },
    {
      content: {
        check: {
          answer: 486.27,
          explanation: t(
            "1240 ÷ 2.55 ≈ 486 nm: blue-green light. A bigger drop than 1.89 eV gives a shorter wavelength, toward blue.",
            "1240 ÷ 2,55 ≈ 486 nm: luz azul-esverdeada. Uma queda maior que 1,89 eV dá um comprimento de onda menor, rumo ao azul.",
          ),
          inputs: [{ name: "energy", value: 2.55 }],
          kind: "numeric",
          question: t(
            "At 2.55 eV, what wavelength comes out?",
            "Com 2,55 eV, qual comprimento de onda sai?",
          ),
          tolerance: { kind: "absolute", value: 1 },
          unit: "nm",
        },
        data: { source: { publisher: "NIST", title: "Atomic Spectra Database: hydrogen lines" } },
        fields: {
          compareAt: 1.89,
          formula: "1240 / energy",
          output: { label: t("Wavelength", "Comprimento de onda"), unit: "nm" },
          variable: {
            initial: 1.89,
            label: t("Energy of the drop", "Energia da queda"),
            max: 3.2,
            min: 1.7,
            name: "energy",
            step: 0.01,
            unit: "eV",
          },
        },
        prompt: t(
          "Move the size of the drop and watch the wavelength. Hydrogen's next drop, from step 4 to step 2, releases 2.55 eV. Set it and read the wavelength.",
          "Mova o tamanho da queda e veja o comprimento de onda. A próxima queda do hidrogênio, do degrau 4 para o 2, libera 2,55 eV. Ajuste e leia o comprimento de onda.",
        ),
        template: "sliderGraph",
      },
      kind: "activity",
      skill: "photon-wavelength",
    },
    {
      content: {
        options: [
          option(
            "drops",
            t(
              "Their electrons make only a few drop sizes, mostly ones that give red-orange light",
              "Os elétrons fazem só alguns tamanhos de queda, principalmente os que dão luz vermelho-alaranjada",
            ),
            t(
              "Right. Each color is one drop size, and neon's staircase has gaps that give mostly red and orange light.",
              "Isso. Cada cor é um tamanho de queda, e a escada do neônio tem degraus que dão principalmente luz vermelha e laranja.",
            ),
            true,
          ),
          option(
            "gas",
            t("Neon gas is red", "O gás neônio é vermelho"),
            t(
              "Neon gas is colorless. The color only appears when electricity kicks its electrons up and they drop back.",
              "O gás neônio é incolor. A cor só aparece quando a eletricidade chuta os elétrons para cima e eles caem de volta.",
            ),
          ),
          option(
            "glass",
            t("The glass tube is painted red", "O tubo de vidro é pintado de vermelho"),
            t(
              "Clear neon tubes glow red-orange too. Signs in other colors use other gases or coated tubes.",
              "Tubos transparentes de neônio também brilham vermelho-alaranjado. Letreiros de outras cores usam outros gases ou tubos revestidos.",
            ),
          ),
        ],
        question: t(
          "Neon signs glow red-orange. What does that tell you about neon atoms?",
          "Letreiros de neon brilham em vermelho-alaranjado. O que isso diz sobre os átomos de neônio?",
        ),
      },
      kind: "check",
      skill: "emission-lines",
    },
    {
      content: {
        text: t(
          "Spread starlight through a prism and you'll find thin lines at exact wavelengths. Each set matches one element's staircase.\n\nIn 1868, astronomers found a yellow line in sunlight that matched no element known on Earth. They named the new element after the Greek word for the Sun, *helios*: helium. It was found on Earth 27 years later.",
          "Passe a luz de uma estrela por um prisma e você verá linhas finas em comprimentos de onda exatos. Cada conjunto corresponde à escada de um elemento.\n\nEm 1868, astrônomos acharam na luz do Sol uma linha amarela que não batia com nenhum elemento conhecido na Terra. Batizaram o novo elemento com a palavra grega para Sol, *helios*: hélio. Ele só foi encontrado na Terra 27 anos depois.",
        ),
        title: t("Reading the stars", "Lendo as estrelas"),
      },
      kind: "explanation",
      skill: "emission-lines",
    },
    {
      content: {
        keyPoints: [
          t(
            "Each firework has different metals in it",
            "Cada fogo de artifício tem metais diferentes",
          ),
          t(
            "Heat kicks the atoms' electrons up, and when they drop back they give off light",
            "O calor chuta os elétrons dos átomos para cima, e ao cair de volta eles soltam luz",
          ),
          t(
            "Each metal can only make certain drop sizes, and the size of the drop decides the color",
            "Cada metal só faz certos tamanhos de queda, e o tamanho da queda decide a cor",
          ),
        ],
        question: t(
          "Your little cousin asks why fireworks come in different colors. Explain it in two or three sentences she'd understand.",
          "Sua prima pequena pergunta por que os fogos de artifício têm cores diferentes. Explique em duas ou três frases que ela entenda.",
        ),
        sampleAnswer: t(
          "Each firework has a different metal inside. The heat of the explosion gives the metal's tiny particles extra energy, and when they calm down they let it out as light. Each metal lets out its energy in its own sizes, and each size is a different color.",
          "Cada fogo de artifício tem um metal diferente dentro. O calor da explosão dá energia extra às partículas minúsculas do metal, e quando elas se acalmam soltam essa energia como luz. Cada metal solta energia nos seus próprios tamanhos, e cada tamanho é uma cor diferente.",
        ),
      },
      kind: "typedAnswer",
      skill: "emission-lines",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "Electrons in atoms can only sit on certain energy steps.",
              "Os elétrons dos átomos só podem ficar em certos degraus de energia.",
            ),
          },
          {
            text: t(
              "When an electron drops a step, the energy it loses leaves as a photon.",
              "Quando um elétron desce um degrau, a energia perdida sai como um fóton.",
            ),
          },
          {
            text: t(
              "The bigger the drop, the more energetic the photon: red is small, violet is big.",
              "Quanto maior a queda, mais energético o fóton: vermelho é pequeno, violeta é grande.",
            ),
          },
          {
            text: t(
              "Wavelength in nm = 1240 ÷ energy in eV.",
              "Comprimento de onda em nm = 1240 ÷ energia em eV.",
            ),
          },
          {
            text: t(
              "Each element has its own steps, so its colors work like a fingerprint.",
              "Cada elemento tem seus próprios degraus, então suas cores funcionam como uma impressão digital.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  supportMode: "explanationFirst",
  title: t("Why colors exist", "Por que as cores existem"),
};
