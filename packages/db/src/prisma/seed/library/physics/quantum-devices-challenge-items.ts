import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** With the course's other items, every phase of a seeded plan has enough for its challenge. */
export const quantumDevicesChallengeItems: SeedItem[] = [
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "The size of the energy gap electrons drop across in the material",
            "O tamanho da diferença de energia que os elétrons descem no material",
          ),
          t(
            "Each drop across the gap releases one photon with exactly that energy, and a photon's energy is its color.",
            "Cada descida pela diferença de energia libera um fóton com exatamente essa energia, e a energia do fóton é a sua cor.",
          ),
        ),
        bankOption(
          t(
            "A colored plastic cap that filters white light",
            "Uma capa de plástico colorida que filtra luz branca",
          ),
          t(
            "A clear LED still glows red or blue. The color is made inside the chip, not filtered out of white.",
            "Um LED transparente continua brilhando vermelho ou azul. A cor é feita dentro do chip, não filtrada da luz branca.",
          ),
          t("Thinks an LED's color comes from a filter", "Acha que a cor do LED vem de um filtro"),
        ),
        bankOption(
          t("How much current flows through it", "Quanta corrente passa por ele"),
          t(
            "More current means more photons, so more brightness. Each photon still has the same energy.",
            "Mais corrente significa mais fótons, ou seja, mais brilho. Cada fóton continua com a mesma energia.",
          ),
          t(
            "Thinks current decides the color instead of the brightness",
            "Acha que a corrente decide a cor em vez do brilho",
          ),
        ),
        bankOption(
          t("How hot the chip gets", "O quanto o chip esquenta"),
          t(
            "That's how an old bulb's filament works. An LED makes light without glowing from heat.",
            "É assim que funciona o filamento de uma lâmpada antiga. O LED faz luz sem brilhar por calor.",
          ),
          t(
            "Confuses an LED with a glowing hot filament",
            "Confunde o LED com um filamento que brilha por estar quente",
          ),
        ),
      ],
      question: t(
        "A red LED and a blue LED run on the same charger. What decides the color each one gives off?",
        "Um LED vermelho e um LED azul funcionam no mesmo carregador. O que decide a cor que cada um emite?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "led-color-gap",
    skill: "leds-lasers",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Blue photons carry more energy, and each photon gets its energy from the gap",
            "Fótons azuis carregam mais energia, e cada fóton recebe sua energia da diferença",
          ),
          t(
            "A photon's energy equals the drop the electron makes, so a higher-energy color needs a wider gap.",
            "A energia do fóton é igual à descida que o elétron faz, então uma cor de energia maior precisa de uma diferença maior.",
          ),
        ),
        bankOption(
          t(
            "Blue light needs more electrons per second",
            "A luz azul precisa de mais elétrons por segundo",
          ),
          t(
            "The number of electrons sets how bright the LED is, not the energy of each photon.",
            "O número de elétrons define o brilho do LED, não a energia de cada fóton.",
          ),
          t(
            "Confuses the number of photons with the energy of each one",
            "Confunde o número de fótons com a energia de cada um",
          ),
        ),
        bankOption(
          t("Blue light has a longer wavelength", "A luz azul tem comprimento de onda maior"),
          t(
            "It's the other way around: blue has a shorter wavelength than red, which is why its photons carry more energy.",
            "É o contrário: o azul tem comprimento de onda menor que o vermelho, por isso seus fótons carregam mais energia.",
          ),
          t(
            "Mixes up which end of the spectrum has the longer wavelength",
            "Troca qual ponta do espectro tem o comprimento de onda maior",
          ),
        ),
        bankOption(
          t(
            "A wider gap makes any light brighter, and blue looks brighter",
            "Uma diferença maior deixa qualquer luz mais forte, e o azul parece mais forte",
          ),
          t(
            "The gap sets the color, not the brightness. Brightness comes from how many photons come out.",
            "A diferença define a cor, não o brilho. O brilho vem de quantos fótons saem.",
          ),
          t(
            "Thinks the energy gap controls brightness",
            "Acha que a diferença de energia controla o brilho",
          ),
        ),
      ],
      question: t(
        "Engineers spent decades looking for a material with a wider energy gap before they could make a bright blue LED. Why does blue need a wider gap than red?",
        "Engenheiros passaram décadas procurando um material com uma diferença de energia maior até conseguir fazer um LED azul forte. Por que o azul precisa de uma diferença maior que o vermelho?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "led-blue-wider-gap",
    skill: "leds-lasers",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks more current raises each photon's energy",
        "Acha que mais corrente aumenta a energia de cada fóton",
      ),
      reason: t(
        "More current sends more electrons across the same gap, so you get more red photons: a brighter red, never green. The gap is fixed by the material.",
        "Mais corrente manda mais elétrons pela mesma diferença de energia, então saem mais fótons vermelhos: um vermelho mais forte, nunca verde. A diferença é fixada pelo material.",
      ),
      statement: t(
        "If you push enough extra current through a red LED, it starts to glow green.",
        "Se você passar corrente extra suficiente por um LED vermelho, ele começa a brilhar verde.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "led-more-current-color",
    skill: "leds-lasers",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Photons trigger excited atoms to release identical photons, all in step",
            "Fótons fazem átomos excitados liberarem fótons idênticos, todos em sincronia",
          ),
          t(
            "That's stimulated emission: the copies share one color and one direction, so the beam stays narrow even at a few milliwatts.",
            "Isso é a emissão estimulada: as cópias têm a mesma cor e a mesma direção, então o feixe fica estreito mesmo com poucos miliwatts.",
          ),
        ),
        bankOption(
          t("It's simply far more powerful", "Ele é simplesmente muito mais potente"),
          t(
            "A laser pointer uses less power than a flashlight. What's special is that its light marches in step, not how much there is.",
            "Uma caneta laser usa menos potência que uma lanterna. O especial é que sua luz anda em sincronia, não a quantidade.",
          ),
          t(
            "Thinks a laser is just a very bright lamp",
            "Acha que o laser é só uma lâmpada muito forte",
          ),
        ),
        bankOption(
          t(
            "A lens squeezes ordinary light into a thin beam",
            "Uma lente aperta a luz comum num feixe fino",
          ),
          t(
            "A lens can't make ordinary light, with its mix of directions and phases, stay as narrow as a laser over a whole room.",
            "Uma lente não consegue fazer a luz comum, com sua mistura de direções e fases, ficar tão estreita quanto um laser por uma sala inteira.",
          ),
          t(
            "Thinks the beam comes from focusing, not from how the light is made",
            "Acha que o feixe vem do foco, não de como a luz é produzida",
          ),
        ),
        bankOption(
          t("It heats a material until it glows", "Ele esquenta um material até brilhar"),
          t(
            "Hot things glow in a broad mix of colors. A laser's single color comes from atoms releasing copies of one photon.",
            "Coisas quentes brilham numa mistura ampla de cores. A cor única do laser vem de átomos liberando cópias de um mesmo fóton.",
          ),
          t(
            "Confuses a laser with a glowing hot object",
            "Confunde o laser com um objeto quente que brilha",
          ),
        ),
      ],
      question: t(
        "The red laser in a supermarket barcode scanner makes a thin beam of a single color. What makes laser light different from an ordinary lamp's?",
        "O laser vermelho do leitor de código de barras do supermercado faz um feixe fino de uma cor só. O que torna a luz do laser diferente da de uma lâmpada comum?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "laser-vs-lamp-light",
    skill: "leds-lasers",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "The LED makes light directly as electrons drop across a gap, so little energy turns into heat",
            "O LED faz luz diretamente quando elétrons descem uma diferença de energia, então pouca energia vira calor",
          ),
          t(
            "An old bulb heats a filament until it glows and loses most of its energy as heat. An LED skips the heating step.",
            "Uma lâmpada antiga esquenta um filamento até ele brilhar e perde a maior parte da energia como calor. O LED pula essa etapa de aquecimento.",
          ),
        ),
        bankOption(
          t(
            "The LED gives off less light, so it makes less heat",
            "O LED emite menos luz, então produz menos calor",
          ),
          t(
            "Both give the same light here. The LED wastes less energy as heat while making it.",
            "Os dois dão a mesma luz aqui. O LED desperdiça menos energia como calor ao produzi-la.",
          ),
          t("Thinks less heat must mean less light", "Acha que menos calor significa menos luz"),
        ),
        bankOption(
          t(
            "Its plastic case traps the heat inside",
            "Sua capa de plástico prende o calor lá dentro",
          ),
          t(
            "Trapped heat would make the LED hotter, not cooler. It stays cool because it makes little heat in the first place.",
            "Calor preso deixaria o LED mais quente, não mais frio. Ele fica frio porque produz pouco calor desde o início.",
          ),
          t(
            "Thinks the heat is blocked rather than never made",
            "Acha que o calor é bloqueado em vez de nem ser produzido",
          ),
        ),
      ],
      question: t(
        "An LED bulb and an old incandescent bulb light a room equally well, but only the old bulb gets too hot to touch. Why?",
        "Uma lâmpada de LED e uma lâmpada incandescente antiga iluminam um cômodo igualmente bem, mas só a antiga fica quente demais para tocar. Por quê?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "led-bulb-stays-cool",
    skill: "leds-lasers",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "It switches a current on and off, which stores and processes 0s and 1s",
            "Ele liga e desliga uma corrente, o que guarda e processa 0s e 1s",
          ),
          t(
            "A small voltage on the transistor's gate opens or closes the path for current. Billions of these switches do the chip's work.",
            "Uma pequena tensão na porta do transistor abre ou fecha o caminho da corrente. Bilhões dessas chaves fazem o trabalho do chip.",
          ),
        ),
        bankOption(
          t(
            "It stores electricity, like a tiny battery",
            "Ele armazena eletricidade, como uma bateria minúscula",
          ),
          t(
            "The battery stores the energy. A transistor controls where current flows, like a faucet.",
            "Quem armazena energia é a bateria. O transistor controla por onde a corrente passa, como uma torneira.",
          ),
          t("Confuses a transistor with a battery", "Confunde o transistor com uma bateria"),
        ),
        bankOption(
          t("It makes the light of the screen", "Ele produz a luz da tela"),
          t(
            "The screen's light comes from LEDs. Transistors decide which pixels get current, but they don't glow.",
            "A luz da tela vem dos LEDs. Os transistores decidem quais pixels recebem corrente, mas não brilham.",
          ),
          t("Confuses transistors with LEDs", "Confunde transistores com LEDs"),
        ),
        bankOption(
          t("It only makes the speaker louder", "Ele só deixa o alto-falante mais alto"),
          t(
            "Transistors can amplify, but in a processor almost all of them work as on-off switches for logic and memory.",
            "Transistores podem amplificar, mas num processador quase todos funcionam como chaves liga-desliga para lógica e memória.",
          ),
          t(
            "Thinks transistors are only amplifiers",
            "Acha que transistores são só amplificadores",
          ),
        ),
      ],
      question: t(
        "Your phone's processor holds billions of transistors. What does each one do?",
        "O processador do seu celular tem bilhões de transistores. O que cada um faz?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "transistor-job",
    skill: "transistors",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Its electrons must cross an energy gap to carry current, so a small voltage or a few added atoms can turn conduction on or off",
            "Seus elétrons precisam atravessar uma diferença de energia para conduzir, então uma pequena tensão ou alguns átomos adicionados ligam ou desligam a condução",
          ),
          t(
            "A semiconductor sits between a metal and an insulator. Quantum physics gives it that gap, and the gap is what makes it switchable.",
            "Um semicondutor fica entre um metal e um isolante. A física quântica lhe dá essa diferença de energia, e é ela que permite ligar e desligar.",
          ),
        ),
        bankOption(
          t("Silicon conducts better than copper", "O silício conduz melhor que o cobre"),
          t(
            "Pure silicon conducts far worse than copper. Its value is that its conduction can be controlled.",
            "O silício puro conduz muito pior que o cobre. Seu valor está em poder controlar a condução.",
          ),
          t(
            "Thinks a better conductor makes a better switch",
            "Acha que um condutor melhor faz uma chave melhor",
          ),
        ),
        bankOption(
          t(
            "Silicon blocks all current, so it's a perfect off switch",
            "O silício bloqueia toda corrente, então é uma chave desligada perfeita",
          ),
          t(
            "A switch that never turns on is useless. Silicon can be made to conduct when the gate voltage asks it to.",
            "Uma chave que nunca liga é inútil. O silício pode passar a conduzir quando a tensão da porta pede.",
          ),
          t(
            "Thinks a semiconductor is just an insulator",
            "Acha que um semicondutor é só um isolante",
          ),
        ),
      ],
      question: t(
        "Chips are made of silicon, a semiconductor, rather than copper. Why can silicon be made into a switch?",
        "Os chips são feitos de silício, um semicondutor, e não de cobre. Por que o silício pode virar uma chave?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "silicon-switches",
    skill: "transistors",
  },
  {
    content: {
      context: null,
      isTrue: true,
      misconception: null,
      reason: t(
        "Electrons in a crystal behave as waves, and only some energies fit: those form bands separated by gaps. The gaps decide whether a solid conducts, and classical physics has no way to produce them.",
        "Elétrons num cristal se comportam como ondas, e só algumas energias cabem: elas formam bandas separadas por intervalos. Esses intervalos decidem se um sólido conduz, e a física clássica não tem como produzi-los.",
      ),
      statement: t(
        "Quantum physics explains why some solids conduct and others don't: in a crystal, electrons can only have energies in allowed bands separated by gaps.",
        "A física quântica explica por que alguns sólidos conduzem e outros não: num cristal, os elétrons só podem ter energias em bandas permitidas, separadas por intervalos.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "energy-bands-quantum",
    skill: "transistors",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Electrons tunnel through the thin barrier, so current leaks even when the switch is off",
            "Os elétrons atravessam a barreira fina por tunelamento, então a corrente vaza mesmo com a chave desligada",
          ),
          t(
            "An electron's wave spreads a little past a barrier. When the barrier is only a few atoms thick, some electrons show up on the other side.",
            "A onda do elétron se espalha um pouco além de uma barreira. Quando a barreira tem só alguns átomos de espessura, alguns elétrons aparecem do outro lado.",
          ),
        ),
        bankOption(
          t(
            "Electrons become too big to fit through the channel",
            "Os elétrons ficam grandes demais para passar pelo canal",
          ),
          t(
            "Electrons have no size that gets in the way. The problem is that they get through where they shouldn't.",
            "Os elétrons não têm um tamanho que atrapalhe. O problema é que eles passam por onde não deveriam.",
          ),
          t(
            "Pictures electrons as balls too large for small parts",
            "Imagina os elétrons como bolinhas grandes demais para peças pequenas",
          ),
        ),
        bankOption(
          t("The chip runs out of electrons", "O chip fica sem elétrons"),
          t(
            "Electrons aren't used up. A circuit moves the same electrons around; the battery supplies the energy.",
            "Os elétrons não se gastam. O circuito move os mesmos elétrons; a bateria fornece a energia.",
          ),
          t(
            "Thinks electrons get used up in a circuit",
            "Acha que os elétrons se gastam num circuito",
          ),
        ),
        bankOption(
          t(
            "Electrons slow down when the parts are smaller",
            "Os elétrons ficam mais lentos quando as peças são menores",
          ),
          t(
            "Smaller parts actually let switches flip faster. The trouble is the leak, not the speed.",
            "Peças menores na verdade deixam as chaves mais rápidas. O problema é o vazamento, não a velocidade.",
          ),
          t(
            "Thinks shrinking slows the electrons down",
            "Acha que diminuir as peças deixa os elétrons mais lentos",
          ),
        ),
      ],
      question: t(
        "In newer chips, the insulating layer in each transistor is only a few atoms thick. What quantum problem shows up as it gets thinner?",
        "Nos chips mais novos, a camada isolante de cada transistor tem só alguns átomos de espessura. Que problema quântico aparece conforme ela fica mais fina?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "transistor-tunneling-leak",
    skill: "transistors",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Confuses chips that rely on quantum physics with quantum computers",
        "Confunde chips que dependem da física quântica com computadores quânticos",
      ),
      reason: t(
        "The transistors need quantum physics to work, but each one holds an ordinary bit, always 0 or 1. A quantum computer is a different machine built around qubits.",
        "Os transistores precisam da física quântica para funcionar, mas cada um guarda um bit comum, sempre 0 ou 1. Um computador quântico é outra máquina, construída com qubits.",
      ),
      statement: t(
        "Since its transistors depend on quantum physics, your phone's processor is a quantum computer that works with qubits.",
        "Como seus transistores dependem da física quântica, o processador do seu celular é um computador quântico que trabalha com qubits.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "chip-not-quantum-computer",
    skill: "transistors",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "A built-in angular momentum that makes it act like a tiny magnet, measured only as up or down",
            "Um momento angular próprio que o faz agir como um ímã minúsculo, medido só como para cima ou para baixo",
          ),
          t(
            "Spin behaves like rotation in the math, but nothing is turning. Along any axis, the measurement gives one of two values.",
            "O spin se comporta como rotação nas contas, mas nada está girando. Em qualquer eixo, a medição dá um de dois valores.",
          ),
        ),
        bankOption(
          t(
            "The electron is a small ball turning on its axis",
            "O elétron é uma bolinha girando em torno do próprio eixo",
          ),
          t(
            "A ball the size the electron could be would have to spin faster than light to match the measured value. The name is a leftover from that picture.",
            "Uma bolinha do tamanho que o elétron poderia ter precisaria girar mais rápido que a luz para dar o valor medido. O nome é uma sobra dessa imagem.",
          ),
          t("Takes the word spin literally", "Leva a palavra spin ao pé da letra"),
        ),
        bankOption(
          t(
            "The electron's motion around the nucleus",
            "O movimento do elétron em volta do núcleo",
          ),
          t(
            "Motion around the nucleus is a separate thing. A free electron, far from any atom, still has spin.",
            "O movimento em volta do núcleo é outra coisa. Um elétron livre, longe de qualquer átomo, também tem spin.",
          ),
          t("Confuses spin with the electron's orbit", "Confunde o spin com a órbita do elétron"),
        ),
        bankOption(
          t("Another name for its electric charge", "Outro nome para sua carga elétrica"),
          t(
            "Charge and spin are different properties. Neutrons have spin with no charge at all.",
            "Carga e spin são propriedades diferentes. Nêutrons têm spin sem ter carga nenhuma.",
          ),
          t("Confuses spin with charge", "Confunde spin com carga"),
        ),
      ],
      question: t(
        "Physicists say every electron has spin. What is spin?",
        "Os físicos dizem que todo elétron tem spin. O que é o spin?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "spin-meaning",
    skill: "spin",
  },
  {
    content: {
      context: t(
        "In 1922, Stern and Gerlach sent a beam of silver atoms through an uneven magnetic field and onto a glass plate. Each atom acts like a tiny magnet because of the spin of one of its electrons.",
        "Em 1922, Stern e Gerlach enviaram um feixe de átomos de prata por um campo magnético desigual até uma placa de vidro. Cada átomo age como um ímã minúsculo por causa do spin de um de seus elétrons.",
      ),
      options: [
        bankOption(
          t(
            "Two separate marks, one up and one down",
            "Duas marcas separadas, uma em cima e outra embaixo",
          ),
          t(
            "Measured along the field, the spin comes out only up or only down, so the beam splits in two.",
            "Medido ao longo do campo, o spin só dá para cima ou para baixo, então o feixe se divide em dois.",
          ),
        ),
        bankOption(
          t("One continuous smear from top to bottom", "Uma mancha contínua de cima a baixo"),
          t(
            "That's what tiny magnets pointing every which way would give. The smear never appeared.",
            "É o que ímãs minúsculos apontando para todo lado dariam. A mancha nunca apareceu.",
          ),
          t(
            "Expects spin to point in any direction, like a classical magnet",
            "Espera que o spin aponte em qualquer direção, como um ímã clássico",
          ),
        ),
        bankOption(
          t("A single mark in the middle", "Uma única marca no meio"),
          t(
            "The field does push on the atoms' tiny magnets. The beam was deflected, not left alone.",
            "O campo empurra sim os ímãs minúsculos dos átomos. O feixe foi desviado, não ficou parado.",
          ),
          t(
            "Thinks the magnetic field has no effect on spin",
            "Acha que o campo magnético não afeta o spin",
          ),
        ),
        bankOption(
          t(
            "Many marks, one for each spin speed",
            "Muitas marcas, uma para cada velocidade de giro",
          ),
          t(
            "There is no spin speed to vary. An electron's spin always has the same size; only up or down shows up.",
            "Não existe velocidade de giro que varie. O spin do elétron tem sempre o mesmo tamanho; só aparece para cima ou para baixo.",
          ),
          t(
            "Thinks spin comes in many sizes, like a spinning top",
            "Acha que o spin tem muitos tamanhos, como um pião",
          ),
        ),
      ],
      question: t("What did the atoms leave on the plate?", "O que os átomos deixaram na placa?"),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "stern-gerlach-two-marks",
    skill: "spin",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Up or down along the horizontal axis, each half the time",
            "Para cima ou para baixo no eixo horizontal, cada um em metade das vezes",
          ),
          t(
            "Being up on one axis doesn't fix a value on a perpendicular one. That second measurement is a fresh coin toss.",
            "Estar para cima num eixo não fixa um valor num eixo perpendicular. Essa segunda medição é um novo cara ou coroa.",
          ),
        ),
        bankOption(
          t(
            "Always up, since it was already measured up",
            "Sempre para cima, já que foi medido para cima",
          ),
          t(
            "That first result only holds along the vertical axis. Along a new axis, the outcome isn't set in advance.",
            "Aquele primeiro resultado só vale no eixo vertical. Num eixo novo, o resultado não está definido antes.",
          ),
          t(
            "Thinks spin has a definite value along every axis at once",
            "Acha que o spin tem um valor definido em todos os eixos ao mesmo tempo",
          ),
        ),
        bankOption(
          t(
            "Zero, because the spin points straight up",
            "Zero, porque o spin aponta reto para cima",
          ),
          t(
            "A classical arrow pointing up has no sideways part, but spin measurements never give zero: only up or down.",
            "Uma seta clássica apontando para cima não tem parte lateral, mas medições de spin nunca dão zero: só para cima ou para baixo.",
          ),
          t(
            "Treats spin as a classical arrow with components",
            "Trata o spin como uma seta clássica com componentes",
          ),
        ),
      ],
      question: t(
        "An electron is measured spin up along the vertical axis. Right after, its spin is measured along the horizontal axis. What comes out?",
        "Um elétron é medido com spin para cima no eixo vertical. Logo depois, seu spin é medido no eixo horizontal. Qual é o resultado?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "spin-other-axis",
    skill: "spin",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks spin varies smoothly like a classical arrow",
        "Acha que o spin varia de forma contínua como uma seta clássica",
      ),
      reason: t(
        "Whatever axis you pick, an electron's spin comes out only up or down, never anything in between. That two-valued answer is what makes spin quantum.",
        "Qualquer que seja o eixo escolhido, o spin do elétron só dá para cima ou para baixo, nunca algo no meio. Essa resposta de dois valores é o que torna o spin quântico.",
      ),
      statement: t(
        "Along any axis you choose, an electron's spin can be measured at any value between fully up and fully down.",
        "Em qualquer eixo escolhido, o spin de um elétron pode ser medido com qualquer valor entre totalmente para cima e totalmente para baixo.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "spin-any-value",
    skill: "spin",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Either 0 or 1, each half the time, and it stays at what you read",
            "Ou 0 ou 1, cada um em metade das vezes, e ele fica no valor lido",
          ),
          t(
            "Reading forces one definite result out of the superposition, with chances set by the state. After that, the qubit is that result.",
            "A leitura força um resultado definido a partir da superposição, com chances dadas pelo estado. Depois disso, o qubit é aquele resultado.",
          ),
        ),
        bankOption(
          t("Both 0 and 1 at the same time", "0 e 1 ao mesmo tempo"),
          t(
            "No reading ever shows both. The superposition is what exists before the measurement, not what you see.",
            "Nenhuma leitura mostra os dois. A superposição é o que existe antes da medição, não o que você vê.",
          ),
          t(
            "Thinks a measurement can show the superposition itself",
            "Acha que a medição pode mostrar a própria superposição",
          ),
        ),
        bankOption(
          t("0.5, halfway between 0 and 1", "0,5, no meio do caminho entre 0 e 1"),
          t(
            "The half is a chance, not a value. Each reading gives a whole 0 or a whole 1.",
            "A metade é uma chance, não um valor. Cada leitura dá um 0 inteiro ou um 1 inteiro.",
          ),
          t(
            "Thinks a superposition is an in-between value",
            "Acha que a superposição é um valor intermediário",
          ),
        ),
        bankOption(
          t(
            "The same result every time you prepare and read it",
            "O mesmo resultado toda vez que você o prepara e lê",
          ),
          t(
            "Prepared the same way, it still gives 0 sometimes and 1 other times. No hidden answer is waiting inside.",
            "Preparado do mesmo jeito, ele ainda dá 0 algumas vezes e 1 outras. Não há uma resposta escondida esperando lá dentro.",
          ),
          t(
            "Thinks the result is decided before the reading",
            "Acha que o resultado já está decidido antes da leitura",
          ),
        ),
      ],
      question: t(
        "A qubit is in an equal superposition of 0 and 1. What do you get when you read it?",
        "Um qubit está numa superposição igual de 0 e 1. O que você obtém ao lê-lo?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "qubit-read-superposition",
    skill: "qubit",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks superposition lets you read out every answer in parallel",
        "Acha que a superposição permite ler todas as respostas em paralelo",
      ),
      reason: t(
        "Reading the qubits gives a single result. A quantum algorithm has to arrange interference so wrong answers cancel and the right one grows, and that only works for some problems.",
        "Ler os qubits dá um único resultado. Um algoritmo quântico precisa organizar a interferência para que as respostas erradas se cancelem e a certa se reforce, e isso só funciona para alguns problemas.",
      ),
      statement: t(
        "Because qubits hold 0 and 1 at once, a quantum computer simply tries every possible answer at the same time and reads out the right one.",
        "Como os qubits guardam 0 e 1 ao mesmo tempo, um computador quântico simplesmente testa todas as respostas possíveis de uma vez e lê a certa.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "qubit-tries-every-answer",
    skill: "qubit",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "A bit is always 0 or 1; a qubit can be in a superposition with a chance of each until it's read",
            "Um bit é sempre 0 ou 1; um qubit pode estar numa superposição, com uma chance de cada, até ser lido",
          ),
          t(
            "Until it's measured, a qubit's state mixes 0 and 1. Reading it still gives a plain 0 or 1.",
            "Até ser medido, o estado do qubit mistura 0 e 1. Lê-lo ainda dá um 0 ou um 1 comum.",
          ),
        ),
        bankOption(
          t(
            "A qubit can store any number between 0 and 1, like 0.37",
            "Um qubit pode guardar qualquer número entre 0 e 1, como 0,37",
          ),
          t(
            "Its chances can take many values, but a reading only ever gives 0 or 1. You can't read out 0.37.",
            "Suas chances podem ter muitos valores, mas uma leitura só dá 0 ou 1. Não dá para ler 0,37.",
          ),
          t(
            "Thinks a qubit is an analog value you can read",
            "Acha que o qubit é um valor analógico que se pode ler",
          ),
        ),
        bankOption(
          t("A qubit is just a much smaller bit", "Um qubit é só um bit muito menor"),
          t(
            "Size isn't the difference. A qubit follows quantum rules that no ordinary bit, however small, does.",
            "O tamanho não é a diferença. Um qubit segue regras quânticas que nenhum bit comum, por menor que seja, segue.",
          ),
          t("Thinks a qubit is a miniaturized bit", "Acha que o qubit é um bit miniaturizado"),
        ),
        bankOption(
          t("A qubit has three values: 0, 1 and both", "Um qubit tem três valores: 0, 1 e ambos"),
          t(
            "Superposition isn't a third value you can read. There are endless mixes of 0 and 1, and every reading lands on one of the two.",
            "A superposição não é um terceiro valor que se possa ler. Há infinitas misturas de 0 e 1, e toda leitura cai em um dos dois.",
          ),
          t(
            "Thinks superposition is a third state",
            "Acha que a superposição é um terceiro estado",
          ),
        ),
      ],
      question: t(
        "How is a qubit different from an ordinary bit?",
        "Qual é a diferença entre um qubit e um bit comum?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "qubit-vs-bit",
    skill: "qubit",
  },
];
