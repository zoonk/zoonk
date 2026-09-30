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
];
