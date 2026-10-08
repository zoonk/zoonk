import { type ImageSceneInput } from "@zoonk/ai/tasks/v2/images/scene";

/** Whether the case needs labels, must have none, or may go either way. */
export type ImageSceneExpected = { labels: "any" | "none" | "some" };

type ImageSceneCase = {
  id: string;
  expectations: string;
  expected: ImageSceneExpected;
  userInput: ImageSceneInput;
};

export const TEST_CASES: ImageSceneCase[] = [
  {
    expectations:
      "A discount as before and after: an old price tag and a new one, maybe a -25% badge. Labels with the prices help here and must be exactly $80 and $60.",
    expected: { labels: "some" },
    id: "discount-en",
    userInput: {
      context: "Personal finance › Percentages › Discounts",
      language: "en",
      request: "Show a price before and after a 25% discount",
      screenText: "A jacket costs $80. With 25% off, you pay 75% of the price: $60.",
      textAllowed: true,
    },
  },
  {
    expectations:
      "The electron cloud: dots densest near a small nucleus, fading outward. At most a short label in Portuguese such as 'núcleo'. No orbit drawn as a path.",
    expected: { labels: "any" },
    id: "electron-cloud-pt",
    userInput: {
      context: "Física quântica › O átomo › Por que o elétron não cai no núcleo",
      language: "pt",
      request: "A nuvem eletrônica, mais densa perto do núcleo",
      screenText:
        "O elétron não gira como um planeta. Ele se espalha numa nuvem de possibilidades: um mapa de onde ele pode estar.",
      textAllowed: true,
    },
  },
  {
    expectations:
      "Cause and effect: a microwave heating food, linked to water molecules spinning. Uses a sequence layout or a clear relation; motion shows spinning.",
    expected: { labels: "any" },
    id: "microwave-en",
    userInput: {
      context: "Everyday physics › Heat › How a microwave heats food",
      language: "en",
      request: "How microwaves make water molecules in food spin and heat up",
      screenText:
        "Microwaves make the water molecules in food spin back and forth millions of times a second. That motion is heat.",
      textAllowed: true,
    },
  },
  {
    expectations:
      "A language course scene for renting a place: a small house with a 'for rent' sign that uses a symbol. No labels at all, and no words written on the sign.",
    expected: { labels: "none" },
    id: "language-house",
    userInput: {
      context: "Spanish for Brazilians › Finding a place to live",
      language: "pt",
      request: "Uma casa para alugar com uma placa na frente",
      screenText: "Se alquila: a casa está disponível para alugar.",
      textAllowed: false,
    },
  },
  {
    expectations:
      "A proportion with a scale or bags of rice: 2 kg for R$ 10 next to 3 kg for R$ 15. Labels, if any, must use exactly these numbers and Brazilian Portuguese.",
    expected: { labels: "some" },
    id: "rule-of-three-pt",
    userInput: {
      context: "Matemática básica › Proporções › Regra de três",
      language: "pt",
      request: "Mostrar que mais quilos custam proporcionalmente mais",
      screenText: "Se 2 kg de arroz custam R$ 10, 3 kg custam R$ 15.",
      textAllowed: true,
    },
  },
  {
    expectations:
      "Only evaporation, the idea on this screen: water rising from a lake or ocean into the air in the sun. It must drop the rest of the water cycle the request lists.",
    expected: { labels: "any" },
    id: "overloaded-water-cycle",
    userInput: {
      context: "Earth science › The water cycle › Evaporation",
      language: "en",
      request:
        "A diagram of the whole water cycle with evaporation, condensation, precipitation, collection, runoff and groundwater, all labeled",
      screenText:
        "The sun heats the ocean, and water rises into the air as invisible vapor. This is evaporation.",
      textAllowed: true,
    },
  },
  {
    expectations:
      "The printing press spreading books: a press and a growing stack or flow of copies. A sequence or motion shows many copies coming from one press. Labels only if short.",
    expected: { labels: "any" },
    id: "printing-press-en",
    userInput: {
      context: "World history › The Renaissance › The printing press",
      language: "en",
      request: "One press making many copies of the same book",
      screenText:
        "Before the press, one scribe took months to copy a book. A press could print hundreds of copies in the same time.",
      textAllowed: true,
    },
  },
  {
    expectations:
      "A plant cell diagram for a question: the cell wall, a large central vacuole, small green chloroplasts and the nucleus are all drawn, with arrows marked only A, B and C. No label names a structure (no 'vacúolo', 'núcleo' or 'cloroplasto'), since the question asks which letter marks the vacuole.",
    expected: { labels: "some" },
    id: "question-cell-diagram-pt",
    userInput: {
      context: "Biologia › Célula › Organelas da célula vegetal",
      language: "pt",
      request:
        "Esquema de célula vegetal com três setas: A no contorno externo espesso, B na grande região clara central, C num pequeno oval verde. Sem nomes de estruturas.",
      screenText: "Na figura, qual letra indica o vacúolo?",
      textAllowed: true,
    },
  },
  {
    expectations:
      "The whole brain seen from the side with the four lobes the screen names, each labeled in English next to its lobe (frontal, parietal, temporal, occipital). Nothing the screen doesn't name.",
    expected: { labels: "some" },
    id: "brain-lobes-en",
    userInput: {
      context: "Human biology › The nervous system › The lobes of the brain",
      language: "en",
      request: "The brain from the side with its four lobes labeled",
      screenText:
        "Your brain has four lobes: the frontal lobe behind your forehead, the parietal lobe on top, the temporal lobe by your ears and the occipital lobe at the back.",
      textAllowed: true,
    },
  },
  {
    expectations:
      "Two paintings compared, one above the other, labeled only 1 and 2: a calm, symmetrical Renaissance scene with soft even light, and a dramatic Baroque scene with a strong diagonal and a bright light against deep shadow. No titles, artists or style names written in the picture, since the question asks which is which.",
    expected: { labels: "some" },
    id: "paintings-comparison-pt",
    userInput: {
      context: "História da arte › Do Renascimento ao Barroco › Comparando pinturas",
      language: "pt",
      request:
        "Duas pinturas para comparar: 1, uma cena renascentista calma e simétrica com luz suave; 2, uma cena barroca com diagonal forte e luz intensa contra sombras profundas",
      screenText: "Qual das pinturas é barroca?",
      textAllowed: true,
    },
  },
  {
    expectations:
      "A syntax tree for 'the cat slept': S at the top splitting into NP and VP, NP over 'the cat' and VP over 'slept', each node a short label joined by thin lines. Labels match the screen exactly.",
    expected: { labels: "some" },
    id: "syntax-tree-en",
    userInput: {
      context: "Introduction to linguistics › Syntax › Syntax trees",
      language: "en",
      request: "A tree for 'the cat slept': S splits into NP 'the cat' and VP 'slept'",
      screenText:
        "Every simple sentence (S) splits into a noun phrase (NP), here 'the cat', and a verb phrase (VP), here 'slept'.",
      textAllowed: true,
    },
  },
  {
    expectations:
      "A lever: a long bar on a triangular fulcrum near one end, a heavy rock on the short side and a hand pushing down on the long side, with labels for the fulcrum, the load and the effort.",
    expected: { labels: "some" },
    id: "lever-en",
    userInput: {
      context: "Physics › Simple machines › How a lever multiplies force",
      language: "en",
      request: "A lever lifting a heavy rock with the fulcrum close to the rock",
      screenText:
        "Put the fulcrum close to the load and push on the far end: a small effort lifts a heavy rock.",
      textAllowed: true,
    },
  },
];
