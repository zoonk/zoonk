import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** With the course's other items, every phase of a seeded plan has enough for its challenge. */
export const atomLightChallengeItems: SeedItem[] = [
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("Millions", "Milhões"),
          t(
            "A period is about half a millimeter wide and an atom about a ten-billionth of a meter, so millions fit across it.",
            "Um ponto final tem cerca de meio milímetro e um átomo, cerca de um décimo de bilionésimo de metro, então milhões cabem nele.",
          ),
        ),
        bankOption(
          t("A handful", "Uns poucos"),
          t(
            "Atoms are far too small for that: even a speck of dust holds trillions of them.",
            "Os átomos são pequenos demais para isso: até um grão de poeira tem trilhões deles.",
          ),
          t(
            "Thinks atoms are almost big enough to see",
            "Acha que os átomos são quase grandes o bastante para ver",
          ),
        ),
        bankOption(
          t("Thousands", "Milhares"),
          t(
            "A thousand atoms in a row span only about a ten-thousandth of a millimeter, far less than a period.",
            "Mil átomos enfileirados cobrem só cerca de um décimo de milésimo de milímetro, bem menos que um ponto final.",
          ),
          t(
            "Underestimates how small atoms are by a factor of a thousand",
            "Subestima em mil vezes o quão pequenos os átomos são",
          ),
        ),
        bankOption(
          t("Trillions", "Trilhões"),
          t(
            "Trillions would fill the whole dot, not one line across it. In a single row, only millions fit.",
            "Trilhões preencheriam o ponto inteiro, não uma fileira atravessando ele. Numa fileira só, cabem milhões.",
          ),
          t(
            "Confuses a row of atoms with all the atoms in an area",
            "Confunde uma fileira de átomos com todos os átomos de uma área",
          ),
        ),
      ],
      question: t(
        "About how many atoms would fit side by side, in a single row, across the period at the end of a sentence?",
        "Mais ou menos quantos átomos caberiam lado a lado, numa única fileira, atravessando o ponto final de uma frase?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "atoms-across-a-period",
    skill: "atom-scale",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks atoms are just below what a better lens could show",
        "Acha que os átomos estão logo abaixo do que uma lente melhor mostraria",
      ),
      reason: t(
        "Visible light waves are thousands of times wider than an atom, so no lens can make atoms out with it. Seeing atoms takes tools like electron microscopes.",
        "As ondas da luz visível são milhares de vezes mais largas que um átomo, então nenhuma lente consegue distinguir átomos com ela. Para ver átomos, é preciso usar ferramentas como microscópios eletrônicos.",
      ),
      statement: t(
        "With a powerful enough ordinary light microscope, you could see the individual atoms in a grain of salt.",
        "Com um microscópio óptico comum potente o bastante, daria para ver os átomos de um grão de sal um por um.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "atoms-light-microscope",
    skill: "atom-scale",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("About the size of a marble", "Mais ou menos do tamanho de uma bolinha de gude"),
          t(
            "Blowing an apple up to Earth's size stretches it about a hundred million times, which turns a ten-billionth of a meter into a centimeter or two.",
            "Ampliar uma maçã até o tamanho da Terra a estica cerca de cem milhões de vezes, o que transforma um décimo de bilionésimo de metro em um ou dois centímetros.",
          ),
        ),
        bankOption(
          t("About the size of a house", "Mais ou menos do tamanho de uma casa"),
          t(
            "Atoms are much smaller than that: even at Earth's size, the apple's atoms would fit in your hand.",
            "Os átomos são bem menores que isso: mesmo com a maçã do tamanho da Terra, os átomos dela caberiam na sua mão.",
          ),
          t(
            "Thinks atoms are much bigger than they are compared with everyday things",
            "Acha que os átomos são bem maiores do que são em comparação com as coisas do dia a dia",
          ),
        ),
        bankOption(
          t("Still too small to see", "Ainda pequenos demais para ver"),
          t(
            "Atoms are tiny but not infinitely small: scaled up a hundred million times, they reach an everyday size.",
            "Os átomos são minúsculos, mas não infinitamente pequenos: ampliados cem milhões de vezes, chegam a um tamanho do dia a dia.",
          ),
          t(
            "Thinks atoms are so small no magnification could make them visible",
            "Acha que os átomos são tão pequenos que nenhuma ampliação os tornaria visíveis",
          ),
        ),
      ],
      question: t(
        "If an apple were blown up to the size of the Earth, about how big would each of its atoms become?",
        "Se uma maçã fosse ampliada até o tamanho da Terra, mais ou menos de que tamanho ficaria cada um dos seus átomos?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "apple-the-size-of-earth",
    skill: "atom-scale",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("A ten-billionth of a meter", "Um décimo de bilionésimo de metro"),
          t(
            "That's the size of an atom: about ten thousand times smaller than a bacterium.",
            "Esse é o tamanho de um átomo: cerca de dez mil vezes menor que uma bactéria.",
          ),
        ),
        bankOption(
          t(
            "A millionth of a meter, like a bacterium",
            "Um milionésimo de metro, como uma bactéria",
          ),
          t(
            "A bacterium is a whole living cell made of billions of atoms.",
            "Uma bactéria é uma célula viva inteira, feita de bilhões de átomos.",
          ),
          t(
            "Confuses atoms with the smallest living things",
            "Confunde os átomos com os menores seres vivos",
          ),
        ),
        bankOption(
          t(
            "A thousandth of a meter, like a grain of sand",
            "Um milésimo de metro, como um grão de areia",
          ),
          t(
            "A grain of sand is something you can see and hold; it contains billions of billions of atoms.",
            "Um grão de areia é algo que você vê e pega; ele contém bilhões de bilhões de átomos.",
          ),
          t(
            "Pictures atoms as tiny grains you could almost see",
            "Imagina os átomos como grãozinhos que quase dá para ver",
          ),
        ),
        bankOption(
          t("A millionth of a billionth of a meter", "Um milionésimo de bilionésimo de metro"),
          t(
            "That's the size of an atom's nucleus, about a hundred thousand times smaller than the whole atom.",
            "Esse é o tamanho do núcleo do átomo, cerca de cem mil vezes menor que o átomo inteiro.",
          ),
          t(
            "Confuses the size of the atom with the size of its nucleus",
            "Confunde o tamanho do átomo com o tamanho do núcleo",
          ),
        ),
      ],
      question: t(
        "Which of these is closest to the width of a single atom?",
        "Qual destas medidas é a mais próxima da largura de um único átomo?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "atom-width",
    skill: "atom-scale",
  },
  {
    content: {
      context: null,
      isTrue: true,
      misconception: null,
      reason: t(
        "A drop holds about a sextillion molecules, a number with 21 zeros. That's billions of times more than the few hundred billion stars in our galaxy.",
        "Uma gota tem cerca de um sextilhão de moléculas, um número com 21 zeros. Isso é bilhões de vezes mais que as poucas centenas de bilhões de estrelas da nossa galáxia.",
      ),
      statement: t(
        "A single drop of water holds more molecules than there are stars in the Milky Way.",
        "Uma única gota de água tem mais moléculas do que há estrelas na Via Láctea.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "drop-versus-galaxy",
    skill: "atom-scale",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "At that scale, the electron spreads like a wave and its energy comes only in certain steps",
            "Nessa escala, o elétron se espalha como uma onda e a energia dele só vem em certos degraus",
          ),
          t(
            "A ball has a clear path and any energy; an electron in an atom has neither, so the everyday description breaks down.",
            "Uma bola tem um caminho definido e qualquer energia; um elétron no átomo não tem nenhum dos dois, então a descrição do dia a dia deixa de valer.",
          ),
        ),
        bankOption(
          t(
            "It moves too fast for instruments to follow its path",
            "Ele se move rápido demais para os instrumentos acompanharem o caminho",
          ),
          t(
            "The problem isn't speed or poor instruments: the electron doesn't have a single path to follow.",
            "O problema não é a velocidade nem instrumentos ruins: o elétron não tem um único caminho a seguir.",
          ),
          t(
            "Thinks quantum behavior is only a limit of our instruments",
            "Acha que o comportamento quântico é só um limite dos instrumentos",
          ),
        ),
        bankOption(
          t(
            "Gravity is much stronger at small scales",
            "A gravidade é muito mais forte em escalas pequenas",
          ),
          t(
            "Gravity is by far the weakest force inside an atom; what changes is how matter itself behaves.",
            "A gravidade é, de longe, a força mais fraca dentro de um átomo; o que muda é o jeito como a própria matéria se comporta.",
          ),
          t(
            "Thinks a stronger force explains the difference",
            "Acha que uma força mais forte explica a diferença",
          ),
        ),
      ],
      question: t(
        "Why can't an electron in an atom be described the way we describe a ball thrown across a room?",
        "Por que um elétron dentro de um átomo não pode ser descrito como descrevemos uma bola jogada de um lado a outro da sala?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "electron-not-a-ball",
    skill: "quantum-rules",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks quantum effects never reach everyday life",
        "Acha que os efeitos quânticos nunca chegam ao dia a dia",
      ),
      reason: t(
        "The colors of fireworks, the chips in your phone and the fact that the atoms around you don't collapse all come from quantum rules.",
        "As cores dos fogos de artifício, os chips do seu celular e o fato de os átomos à sua volta não colapsarem vêm das regras quânticas.",
      ),
      statement: t(
        "Quantum rules only matter in physics labs; nothing in everyday life depends on them.",
        "As regras quânticas só importam em laboratórios de física; nada no dia a dia depende delas.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "quantum-in-everyday-life",
    skill: "quantum-rules",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Its energy steps exist but are far too small to notice",
            "Os degraus de energia dele existem, mas são pequenos demais para perceber",
          ),
          t(
            "Quantum rules apply to everything, but for a pendulum the steps are trillions of trillions of times smaller than its energy.",
            "As regras quânticas valem para tudo, mas num pêndulo os degraus são trilhões de trilhões de vezes menores que a energia dele.",
          ),
        ),
        bankOption(
          t(
            "Quantum rules switch off above a certain size",
            "As regras quânticas deixam de valer acima de certo tamanho",
          ),
          t(
            "There's no size where the rules stop; their effects just shrink out of sight for big, warm objects.",
            "Não existe um tamanho em que as regras param; os efeitos delas só ficam pequenos demais para ver em objetos grandes e quentes.",
          ),
          t(
            "Thinks there's a hard border where quantum rules stop",
            "Acha que existe uma fronteira rígida onde as regras quânticas param",
          ),
        ),
        bankOption(
          t("Only electrons have energy steps", "Só os elétrons têm degraus de energia"),
          t(
            "Any trapped or swinging system has energy steps, from atoms to molecules to pendulums.",
            "Todo sistema preso ou oscilando tem degraus de energia, de átomos a moléculas e pêndulos.",
          ),
          t(
            "Thinks energy steps are a special property of electrons",
            "Acha que degraus de energia são uma propriedade especial dos elétrons",
          ),
        ),
      ],
      question: t(
        "An electron in an atom can only have certain energies, but a swinging pendulum seems able to have any. Why don't we notice steps in the pendulum's energy?",
        "Um elétron num átomo só pode ter certas energias, mas um pêndulo balançando parece poder ter qualquer uma. Por que não percebemos degraus na energia do pêndulo?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "pendulum-energy-steps",
    skill: "quantum-rules",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "The atom's energy comes in steps, so it can only give off certain amounts",
            "A energia do átomo vem em degraus, então ele só consegue liberar certas quantidades",
          ),
          t(
            "Each color is one jump between energy steps. With only a few possible jumps, only a few colors come out.",
            "Cada cor é um salto entre degraus de energia. Com poucos saltos possíveis, só saem poucas cores.",
          ),
        ),
        bankOption(
          t(
            "The glass of the tube blocks the other colors",
            "O vidro do tubo bloqueia as outras cores",
          ),
          t(
            "Nothing is being filtered: the missing colors are never made in the first place.",
            "Nada está sendo filtrado: as cores que faltam nunca chegam a ser produzidas.",
          ),
          t(
            "Thinks the missing colors are filtered out",
            "Acha que as cores que faltam são filtradas",
          ),
        ),
        bankOption(
          t(
            "The other colors are there but too dim to see",
            "As outras cores estão lá, mas fracas demais para ver",
          ),
          t(
            "Even sensitive instruments find darkness between the lines: those colors aren't emitted at all.",
            "Mesmo instrumentos sensíveis encontram escuridão entre as linhas: essas cores não são emitidas.",
          ),
          t(
            "Thinks every color is emitted, just some faintly",
            "Acha que todas as cores são emitidas, só que algumas fracas",
          ),
        ),
      ],
      question: t(
        "A tube of glowing hydrogen gives off light in only a few sharp colors, not a smooth rainbow. What does this show?",
        "Um tubo com hidrogênio brilhando emite luz em só algumas cores bem definidas, não num arco-íris contínuo. O que isso mostra?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "hydrogen-few-colors",
    skill: "quantum-rules",
  },
  {
    content: {
      context: null,
      isTrue: true,
      misconception: null,
      reason: t(
        "In 1999, molecules of 60 carbon atoms passed through a grating and formed an interference pattern, and molecules of about 2,000 atoms have since done the same. Quantum rules don't stop at a size.",
        "Em 1999, moléculas de 60 átomos de carbono passaram por uma grade e formaram um padrão de interferência, e moléculas de cerca de 2.000 átomos já fizeram o mesmo. As regras quânticas não param num tamanho.",
      ),
      statement: t(
        "Large molecules made of dozens of atoms have been shown to spread and interfere like waves, just as electrons do.",
        "Já se mostrou que moléculas grandes, feitas de dezenas de átomos, se espalham e interferem como ondas, assim como os elétrons.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "molecules-interfere",
    skill: "quantum-rules",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "The red one's waves are longer from crest to crest",
            "As ondas da vermelha são mais longas de crista a crista",
          ),
          t(
            "Red light's wavelength is about 650 nanometers and blue's about 450: the wavelength is what sets the color.",
            "O comprimento de onda da luz vermelha é cerca de 650 nanômetros e o da azul, cerca de 450: é o comprimento de onda que define a cor.",
          ),
        ),
        bankOption(
          t("The blue one's waves travel faster", "As ondas da azul viajam mais rápido"),
          t(
            "In air, every color of light travels at practically the same speed.",
            "No ar, todas as cores de luz viajam praticamente na mesma velocidade.",
          ),
          t("Thinks color changes the speed of light", "Acha que a cor muda a velocidade da luz"),
        ),
        bankOption(
          t("The red one's waves are taller", "As ondas da vermelha são mais altas"),
          t(
            "How tall a wave is sets its brightness, not its color.",
            "A altura da onda define o brilho, não a cor.",
          ),
          t("Confuses brightness with color", "Confunde brilho com cor"),
        ),
        bankOption(
          t("The blue one's waves are longer", "As ondas da azul são mais longas"),
          t(
            "It's the other way around: blue sits at the short-wavelength end of the colors we see.",
            "É o contrário: o azul fica na ponta de comprimentos de onda curtos das cores que enxergamos.",
          ),
          t(
            "Mixes up which end of the spectrum has longer waves",
            "Confunde qual ponta do espectro tem as ondas mais longas",
          ),
        ),
      ],
      question: t(
        "You have a red laser pointer and a blue one. What is different about their light waves?",
        "Você tem uma caneta laser vermelha e uma azul. O que é diferente nas ondas de luz delas?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "red-and-blue-lasers",
    skill: "light-wave",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("Violet", "Violeta"),
          t(
            "Violet is at the short-wavelength end of the colors we see, opposite red.",
            "O violeta fica na ponta de comprimentos de onda curtos das cores que enxergamos, do lado oposto ao vermelho.",
          ),
        ),
        bankOption(
          t("Red", "Vermelho"),
          t(
            "Red has the longest wavelength we can see, not the shortest.",
            "O vermelho tem o maior comprimento de onda que enxergamos, não o menor.",
          ),
          t(
            "Mixes up which end of the spectrum has shorter waves",
            "Confunde qual ponta do espectro tem as ondas mais curtas",
          ),
        ),
        bankOption(
          t("Green", "Verde"),
          t(
            "Green sits in the middle of the colors, between red's long waves and violet's short ones.",
            "O verde fica no meio das cores, entre as ondas longas do vermelho e as curtas do violeta.",
          ),
          t(
            "Thinks the brightest-looking color has the shortest waves",
            "Acha que a cor que parece mais clara tem as ondas mais curtas",
          ),
        ),
        bankOption(
          t(
            "None: the prism colors light that has a single wavelength",
            "Nenhuma: o prisma colore uma luz que tem um único comprimento de onda",
          ),
          t(
            "Sunlight already holds every color; the prism only bends each wavelength by a different amount and spreads them apart.",
            "A luz do Sol já tem todas as cores; o prisma só desvia cada comprimento de onda de um jeito diferente e as separa.",
          ),
          t(
            "Thinks the prism adds the colors instead of separating them",
            "Acha que o prisma acrescenta as cores em vez de separá-las",
          ),
        ),
      ],
      question: t(
        "Sunlight passing through a prism spreads into red, orange, yellow, green, blue and violet. Which of these colors has the shortest wavelength?",
        "A luz do Sol, ao passar por um prisma, se abre em vermelho, laranja, amarelo, verde, azul e violeta. Qual dessas cores tem o menor comprimento de onda?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "prism-shortest-wavelength",
    skill: "light-wave",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Confuses brightness with wavelength",
        "Confunde brilho com comprimento de onda",
      ),
      reason: t(
        "More power makes the waves taller, not longer. The wavelength stays the same, so the laser stays the same red.",
        "Mais potência deixa as ondas mais altas, não mais longas. O comprimento de onda continua igual, então o laser continua no mesmo vermelho.",
      ),
      statement: t(
        "Turning up a red laser's power makes its light waves longer.",
        "Aumentar a potência de um laser vermelho deixa as ondas de luz dele mais longas.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "brighter-laser-wavelength",
    skill: "light-wave",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Each ultraviolet photon carries enough energy to damage skin cells; a red photon never does",
            "Cada fóton ultravioleta carrega energia suficiente para danificar células da pele; um fóton vermelho nunca carrega",
          ),
          t(
            "Damage happens one photon at a time. More red photons add warmth, but none of them can break the molecules in a cell.",
            "O dano acontece um fóton por vez. Mais fótons vermelhos trazem calor, mas nenhum deles consegue quebrar as moléculas de uma célula.",
          ),
        ),
        bankOption(
          t(
            "Ultraviolet light is brighter than the red lamp",
            "A luz ultravioleta é mais forte que a lâmpada vermelha",
          ),
          t(
            "A red lamp can be far brighter than the ultraviolet in sunlight and still never burn you.",
            "Uma lâmpada vermelha pode ser bem mais forte que o ultravioleta da luz do Sol e mesmo assim nunca queimar você.",
          ),
          t(
            "Thinks the effect depends on how bright the light is",
            "Acha que o efeito depende de quão forte é a luz",
          ),
        ),
        bankOption(
          t("Skin reflects all red light", "A pele reflete toda a luz vermelha"),
          t(
            "Skin absorbs plenty of red light; that's why a red lamp feels warm.",
            "A pele absorve bastante luz vermelha; é por isso que uma lâmpada vermelha parece quente.",
          ),
          t(
            "Thinks red light never gets into the skin",
            "Acha que a luz vermelha nunca entra na pele",
          ),
        ),
      ],
      question: t(
        "Ultraviolet light from the Sun can cause sunburn, but even a very bright red lamp can't. Why?",
        "A luz ultravioleta do Sol pode causar queimadura, mas nem uma lâmpada vermelha muito forte consegue. Por quê?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "sunburn-photon-energy",
    skill: "photon",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("A violet photon", "Um fóton violeta"),
          t(
            "A photon's energy grows as its wavelength shrinks, and violet has the shortest waves of these.",
            "A energia de um fóton cresce quando o comprimento de onda diminui, e o violeta tem as ondas mais curtas destas.",
          ),
        ),
        bankOption(
          t("A red photon", "Um fóton vermelho"),
          t(
            "Red's long waves mean less energy per photon, not more.",
            "As ondas longas do vermelho significam menos energia por fóton, não mais.",
          ),
          t(
            "Thinks longer waves carry more energy",
            "Acha que ondas mais longas carregam mais energia",
          ),
        ),
        bankOption(
          t(
            "An infrared photon from a heat lamp",
            "Um fóton infravermelho de uma lâmpada de aquecimento",
          ),
          t(
            "A heat lamp warms you with huge numbers of photons, each carrying less energy than a red one.",
            "Uma lâmpada de aquecimento esquenta com uma quantidade enorme de fótons, cada um com menos energia que um vermelho.",
          ),
          t(
            "Thinks light that feels hot has stronger photons",
            "Acha que a luz que parece quente tem fótons mais fortes",
          ),
        ),
        bankOption(
          t("They all carry the same energy", "Todos carregam a mesma energia"),
          t(
            "Photons differ: each one's energy is set by its color.",
            "Os fótons são diferentes: a energia de cada um é definida pela cor.",
          ),
          t("Thinks every photon is the same", "Acha que todo fóton é igual"),
        ),
      ],
      question: t(
        "Which single photon carries the most energy?",
        "Qual fóton, sozinho, carrega mais energia?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "most-energetic-photon",
    skill: "photon",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Bands where many dots land, separated by bands with almost none",
            "Faixas onde caem muitos pontos, separadas por faixas quase sem nenhum",
          ),
          t(
            "Each electron arrives as one dot, like a particle, but the dots pile up in the stripes of a wave's interference.",
            "Cada elétron chega como um ponto, como uma partícula, mas os pontos se acumulam nas listras da interferência de uma onda.",
          ),
        ),
        bankOption(
          t(
            "Two stripes of dots, one behind each slit",
            "Duas listras de pontos, uma atrás de cada fenda",
          ),
          t(
            "That's what tiny balls would do. Electrons also spread like waves through both slits, which makes many stripes.",
            "Isso é o que bolinhas fariam. Os elétrons também se espalham como ondas pelas duas fendas, o que forma muitas listras.",
          ),
          t("Treats electrons only as tiny balls", "Trata os elétrons só como bolinhas"),
        ),
        bankOption(
          t(
            "A smooth, even glow with no separate dots",
            "Um brilho contínuo e uniforme, sem pontos separados",
          ),
          t(
            "Every electron lands in one single spot; the pattern only appears as the dots add up.",
            "Cada elétron cai num único ponto; o padrão só aparece quando os pontos se somam.",
          ),
          t(
            "Thinks electrons arrive spread out, only as waves",
            "Acha que os elétrons chegam espalhados, só como ondas",
          ),
        ),
      ],
      question: t(
        "Electrons are fired one at a time toward a barrier with two narrow slits. After thousands of them, what has built up on the detector behind it?",
        "Elétrons são disparados um de cada vez contra uma barreira com duas fendas estreitas. Depois de milhares deles, o que se forma no detector atrás dela?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "electrons-one-at-a-time",
    skill: "duality",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks the stripes come from particles bumping into each other",
        "Acha que as listras vêm de partículas se chocando",
      ),
      reason: t(
        "The stripes appear even when electrons are sent one at a time, minutes apart. Each one spreads like a wave through both slits and interferes with itself.",
        "As listras aparecem mesmo quando os elétrons são enviados um de cada vez, com minutos de intervalo. Cada um se espalha como onda pelas duas fendas e interfere consigo mesmo.",
      ),
      statement: t(
        "In the double-slit experiment, the stripes appear because many electrons pass through together and bump into each other.",
        "No experimento da dupla fenda, as listras aparecem porque muitos elétrons passam juntos e se chocam uns com os outros.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "stripes-not-collisions",
    skill: "duality",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "The stripes disappear and two plain bands remain",
            "As listras somem e ficam só duas faixas simples",
          ),
          t(
            "Finding out the slit forces each electron to act like a particle, so the wave interference is gone.",
            "Descobrir a fenda obriga cada elétron a agir como partícula, então a interferência da onda desaparece.",
          ),
        ),
        bankOption(
          t("The stripes stay exactly the same", "As listras continuam exatamente iguais"),
          t(
            "Learning which slit each electron took always wipes out the stripes.",
            "Saber por qual fenda cada elétron passou sempre apaga as listras.",
          ),
          t(
            "Thinks checking the path doesn't affect the electrons",
            "Acha que verificar o caminho não afeta os elétrons",
          ),
        ),
        bankOption(
          t("The electrons stop arriving", "Os elétrons param de chegar"),
          t(
            "The electrons still reach the detector; only the pattern they make changes.",
            "Os elétrons continuam chegando ao detector; só muda o padrão que eles formam.",
          ),
          t("Thinks watching blocks the particles", "Acha que observar bloqueia as partículas"),
        ),
        bankOption(
          t("The stripes get sharper", "As listras ficam mais nítidas"),
          t(
            "More information about the path means less interference, not more.",
            "Mais informação sobre o caminho significa menos interferência, não mais.",
          ),
          t(
            "Thinks measuring more carefully improves the pattern",
            "Acha que medir com mais cuidado melhora o padrão",
          ),
        ),
      ],
      question: t(
        "In the double-slit experiment with electrons, a detector is added to find out which slit each electron goes through. What happens to the pattern?",
        "No experimento da dupla fenda com elétrons, coloca-se um detector para descobrir por qual fenda cada elétron passa. O que acontece com o padrão?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "which-slit-detector",
    skill: "duality",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "In the nucleus, a tiny core at its center",
            "No núcleo, um caroço minúsculo no centro",
          ),
          t(
            "Protons and neutrons are each about 1,800 times heavier than an electron, and they're all packed in the nucleus.",
            "Prótons e nêutrons são cada um cerca de 1.800 vezes mais pesados que um elétron, e ficam todos no núcleo.",
          ),
        ),
        bankOption(
          t("Spread evenly through the whole atom", "Espalhada por igual pelo átomo inteiro"),
          t(
            "An atom isn't a solid ball: its mass is packed in a nucleus about a hundred thousand times narrower than the atom.",
            "Um átomo não é uma bola maciça: a massa dele fica num núcleo cerca de cem mil vezes mais estreito que o átomo.",
          ),
          t("Pictures the atom as a solid ball", "Imagina o átomo como uma bola maciça"),
        ),
        bankOption(
          t("In the electrons around the nucleus", "Nos elétrons em volta do núcleo"),
          t(
            "Electrons take up most of the space but are the lightest part, far lighter than protons and neutrons.",
            "Os elétrons ocupam a maior parte do espaço, mas são a parte mais leve, bem mais leves que prótons e nêutrons.",
          ),
          t(
            "Thinks what takes up the most space is the heaviest part",
            "Acha que o que ocupa mais espaço é a parte mais pesada",
          ),
        ),
      ],
      question: t(
        "Where is almost all of an atom's mass?",
        "Onde está quase toda a massa de um átomo?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "where-the-mass-is",
    skill: "atom-structure",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("A speck smaller than a grain of sand", "Um pontinho menor que um grão de areia"),
          t(
            "The nucleus holds nearly all the mass but takes up about a millionth of a billionth of the atom's volume, so a whole body would shrink to a speck.",
            "O núcleo guarda quase toda a massa, mas ocupa cerca de um milionésimo de bilionésimo do volume do átomo, então um corpo inteiro viraria um pontinho.",
          ),
        ),
        bankOption(
          t("About the size of a fist", "Mais ou menos do tamanho de um punho"),
          t(
            "That's far too big: atoms are emptier than that, almost entirely empty space around a tiny nucleus.",
            "Isso é grande demais: os átomos são mais vazios que isso, quase só espaço vazio em volta de um núcleo minúsculo.",
          ),
          t("Underestimates how empty atoms are", "Subestima o quanto os átomos são vazios"),
        ),
        bankOption(
          t("About half the person's size", "Mais ou menos metade do tamanho da pessoa"),
          t(
            "Atoms aren't half full: the nucleus is about a hundred thousand times narrower than the atom.",
            "Os átomos não são meio cheios: o núcleo é cerca de cem mil vezes mais estreito que o átomo.",
          ),
          t("Thinks atoms are mostly solid", "Acha que os átomos são quase maciços"),
        ),
      ],
      question: t(
        "If all the empty space inside the atoms of a person's body could be squeezed out, about how big would the remaining matter be?",
        "Se todo o espaço vazio dentro dos átomos do corpo de uma pessoa pudesse ser espremido para fora, mais ou menos de que tamanho ficaria a matéria restante?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "body-without-empty-space",
    skill: "atom-structure",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "It goes up, because a squeezed electron jitters more",
            "Ela sobe, porque um elétron espremido se agita mais",
          ),
          t(
            "The less room a particle has, the more it jitters, and that jitter is energy.",
            "Quanto menos espaço uma partícula tem, mais ela se agita, e essa agitação é energia.",
          ),
        ),
        bankOption(
          t(
            "It goes down, because there's less room to move",
            "Ela desce, porque há menos espaço para se mover",
          ),
          t(
            "In the quantum world, it's the other way around: less room means more motion, not less.",
            "No mundo quântico, é o contrário: menos espaço significa mais movimento, não menos.",
          ),
          t(
            "Applies everyday intuition about tight spaces",
            "Aplica a intuição do dia a dia sobre espaços apertados",
          ),
        ),
        bankOption(
          t(
            "It stays the same, because it's the same electron",
            "Ela continua igual, porque é o mesmo elétron",
          ),
          t(
            "The lowest energy depends on the space the electron is held in, not just on the electron.",
            "A energia mínima depende do espaço em que o elétron está preso, não só do elétron.",
          ),
          t(
            "Thinks a particle's energy doesn't depend on its confinement",
            "Acha que a energia de uma partícula não depende do confinamento",
          ),
        ),
      ],
      question: t(
        "An electron is moved from a large box into a much smaller one. What happens to its lowest possible energy?",
        "Um elétron é passado de uma caixa grande para uma bem menor. O que acontece com a menor energia possível dele?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "smaller-box-energy",
    skill: "confinement",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks enough cooling stops all motion",
        "Acha que esfriar o suficiente faz todo movimento parar",
      ),
      reason: t(
        "Being confined always costs some jitter: even at its lowest energy, a trapped particle keeps moving, and that leftover energy can't be taken away.",
        "Estar confinada sempre custa alguma agitação: mesmo na menor energia, uma partícula presa continua se mexendo, e essa energia que sobra não pode ser retirada.",
      ),
      statement: t(
        "A particle trapped in a tiny space, cooled to its lowest possible energy, sits perfectly still.",
        "Uma partícula presa num espaço minúsculo, resfriada até a menor energia possível, fica perfeitamente parada.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "trapped-never-still",
    skill: "confinement",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks atoms slowly run down as the electron falls in",
        "Acha que os átomos se desgastam aos poucos com o elétron caindo",
      ),
      reason: t(
        "In the ground state, the electron has no lower energy to drop to: getting closer would cost more jitter than it gains. A hydrogen atom left alone keeps its size for good.",
        "No estado fundamental, o elétron não tem energia mais baixa para onde cair: chegar mais perto custaria mais agitação do que ganharia. Um átomo de hidrogênio deixado em paz mantém o tamanho para sempre.",
      ),
      statement: t(
        "The electron in a hydrogen atom slowly loses energy and spirals into the nucleus over billions of years.",
        "O elétron de um átomo de hidrogênio perde energia aos poucos e cai em espiral no núcleo ao longo de bilhões de anos.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "no-slow-spiral",
    skill: "ground-state",
  },
];
