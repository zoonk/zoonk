import { type TestCase } from "@/lib/types";
import { type WriteWarmUpCardsParams } from "@zoonk/ai/tasks/warm-up/write-warm-up-cards";

type WarmUpCardsInput = Pick<
  WriteWarmUpCardsParams,
  "goal" | "kind" | "language" | "subjects" | "targetLanguage"
>;

const REFERENCE_NOTE = `The cards don't need to match the hand-checked reference deck below; they should reach its bar: as true, as surprising and as close to what a beginner learns first.`;

export const TEST_CASES: TestCase<unknown, WarmUpCardsInput>[] = [
  {
    expectations: `About 10 cards in US English on the first ideas of beekeeping. ${REFERENCE_NOTE}
Reference deck (right answer marked ✓):
1. Why do beekeepers puff smoke into a hive before opening it? To put the bees to sleep / To hide the bees' alarm scent ✓ / To warm up the hive. Smoke masks the alarm scent that guard bees release, so fewer bees join in. Many also fill up on honey, which makes them calmer.
2. How many eyes does a honey bee have? 2 / 5 ✓ / 8. Five: two big compound eyes on the sides of the head, and three small simple eyes on top that mostly sense light.
3. Who does almost all the work in a hive: foraging, cleaning and guarding? Male drones / The queen / Female workers ✓. Drones are the males, and their main job is to mate with young queens from other colonies.
4. A bee doing a "waggle dance" in the hive is telling the others… Where to find food ✓ / That the hive is too hot / That the queen has died. The angle points the way relative to the sun, and the length of each waggle says how far to fly.
5. Where does beeswax come from? Pollen the bees collect / Tree resin / Glands on a worker bee's belly ✓.
6. Nectar turns into honey mostly by… Mixing with pollen / Losing most of its water ✓ / Fermenting in the comb.
7. Who lives longer? A summer worker / A queen ✓.
8. Varroa, a pest every beekeeper learns to check for, is a kind of… Wasp / Mite ✓ / Fungus.
Penalize myths such as "bees die after any sting" or "smoke puts bees to sleep" stated as facts, and colony sizes or honey yields given as exact figures.`,
    id: "en-beekeeping",
    userInput: { goal: "Beekeeping", kind: "learn", language: "en" },
  },
  {
    expectations: `About 10 cards in Brazilian Portuguese for a Brazilian learning Spanish: false friends and cognates, first words and phrases, one grammar surprise, one usage note. Spanish words in quotes, written as in Spanish; everything else in Brazilian Portuguese. ${REFERENCE_NOTE}
Reference deck (resposta certa marcada com ✓):
1. Em espanhol, "embarazada" quer dizer… Envergonhada / Grávida ✓ / Cansada. Para dizer que está envergonhada, use "avergonzada".
2. Se alguém na Espanha diz que a comida está "exquisita", essa pessoa achou a comida… Estranha / Deliciosa ✓.
3. "Polvo", em espanhol, é… Povo / O animal de oito braços / Pó ✓. O animal se chama "pulpo", e povo é "pueblo".
4. Quem trabalha numa "oficina" na Espanha trabalha num… Escritório ✓ / Conserto de carros. Oficina mecânica, em espanhol, é "taller".
5. Uma "calle larga" é uma rua… Comprida ✓ / Larga. Para a largura, o espanhol usa "ancho".
6. "Espera un rato" quer dizer… Cuidado com o rato / Espera um pouco ✓ / Espera rápido.
7. "Me gusta el café", ao pé da letra, é… Eu gosto do café / O café me agrada ✓. Por isso, no plural, fica "me gustan los libros".
8. "Apellido", em espanhol, é… Sobrenome ✓ / Apelido. Apelido, em espanhol, é "apodo".
A false friend must hold in Brazilian Portuguese. Penalize usage that only holds in some Spanish-speaking countries shown as universal (for example "coger" as the neutral word for "pegar" everywhere), regional slang, and Portugal's Portuguese.`,
    id: "pt-espanhol",
    userInput: { goal: "Espanhol", kind: "language", language: "pt", targetLanguage: "es" },
  },
  {
    expectations: `About 10 cards in Brazilian Portuguese on basic concepts from the Enem's areas (Linguagens, Ciências Humanas, Ciências da Natureza, Matemática), one or two per area. "Enem", never "ENEM". Amounts in reais written the Brazilian way. ${REFERENCE_NOTE}
Reference deck (resposta certa marcada com ✓):
1. Qual parte da célula vegetal faz a fotossíntese? Mitocôndria / Cloroplasto ✓ / Ribossomo.
2. Um produto de R$ 80 está com 25% de desconto. Quanto você paga? R$ 55 / R$ 60 ✓ / R$ 64.
3. O que a Lei Áurea, de 1888, fez? Proclamou a República / Declarou a independência / Aboliu a escravidão no Brasil ✓.
4. Em "Ele correu tanto que ficou sem fôlego", a parte "que ficou sem fôlego" indica… Consequência ✓ / Causa / Condição.
5. Por que o gelo boia na água? Tem ar preso dentro / É menos denso que a água líquida ✓ / É mais frio que a água.
6. Qual bioma cobre a maior parte do território brasileiro? Cerrado / Mata Atlântica / Amazônia ✓.
7. Num dia de sol, por que uma camiseta preta esquenta mais que uma branca? Absorve mais luz ✓ / Reflete mais luz / Conduz eletricidade.
8. Uma receita para 4 pessoas usa 3 ovos. Para 8 pessoas, quantos ovos? 6 ✓ / 7 / 12.
Score accuracy at most 6 when any card is about the Enem itself (dates, number of questions, scoring, the TRI, cutoffs, the essay's rules).`,
    id: "pt-enem",
    userInput: {
      goal: "Enem",
      kind: "exam",
      language: "pt",
      subjects: [
        "Linguagens, Códigos e suas Tecnologias",
        "Ciências Humanas e suas Tecnologias",
        "Ciências da Natureza e suas Tecnologias",
        "Matemática e suas Tecnologias",
      ],
    },
  },
  {
    expectations: `About 10 cards in US English on what a beginner meets in the first weeks of Python, such as what a variable holds, indentation, lists and their indexes starting at 0, strings, loops, functions, why "=" and "==" differ. Code fragments may appear in the question or options as plain text, short and exactly right (no Markdown backticks). Penalize version-specific facts (release numbers, "the newest Python"), library popularity claims and anything a Python expert would argue about.`,
    id: "en-python",
    userInput: { goal: "Python programming", kind: "learn", language: "en" },
  },
  {
    expectations: `About 10 cards in US English on the first ideas of quantum physics for a beginner, such as quantization of energy, photons, wave-particle duality, the double-slit experiment, superposition, the uncertainty principle, tunneling. Explanations stay true when simplified. Penalize popular myths stated as facts (that observation means a conscious observer, that entanglement sends messages faster than light, that the uncertainty principle is only about clumsy measurement), quotes ("God does not play dice", "nobody understands quantum mechanics") and claims about the latest quantum computers.`,
    id: "en-quantum-physics",
    userInput: { goal: "Quantum physics", kind: "learn", language: "en" },
  },
  {
    expectations: `About 10 cards in Brazilian Portuguese on basic, stable legal concepts from the OAB exam's subjects (ethics, constitutional, civil, criminal, administrative, labor, tax and procedural law), one or two per subject, such as what a habeas corpus protects, the separation of powers, what a statute of limitations is. Score accuracy at most 6 when a card is about the exam itself (number of questions, pass mark, phases, fees, dates), gives legal advice for someone's own case, or relies on a recent change in a law. Article numbers are fine only for the Constitution's stable, famous ones.`,
    id: "pt-oab",
    userInput: {
      goal: "Exame de Ordem da OAB",
      kind: "exam",
      language: "pt",
      subjects: [
        "Ética Profissional",
        "Direito Constitucional",
        "Direito Civil",
        "Direito Penal",
        "Direito Administrativo",
        "Direito do Trabalho",
        "Direito Tributário",
        "Direito Processual Civil",
      ],
    },
  },
  {
    expectations: `About 10 cards in Mexican Spanish (tú, never vosotros or vos) for a Spanish speaker learning English, such as false friends ("embarrassed", "actually", "library", "carpet", "exit"), first words and phrases, one grammar surprise (adjectives before nouns, "I am 20 years old"), one usage note. English words in quotes; everything else in Spanish. Penalize British-only or American-only usage shown as universal, slang, and Spain's Spanish.`,
    id: "es-english",
    userInput: { goal: "Inglés", kind: "language", language: "es", targetLanguage: "en" },
  },
  {
    expectations: `About 10 cards in US English for an English speaker starting Japanese, such as the three scripts (hiragana, katakana, kanji) and what each is for, word order with the verb at the end, particles such as "は" and "を", politeness with "です" and "ます", counters, loanwords written in katakana. Japanese words in quotes, in Japanese script with a romanization where it helps. Every card about a word, particle or phrase shows it in its question: score pretest at most 6 when a card asks about "this word" without showing it. Penalize regional dialect shown as standard, wrong readings, wrong loanword origins (コーヒー came from Dutch), and claims about how many kanji someone "needs" as an exact figure.`,
    id: "en-japanese",
    userInput: { goal: "Japanese", kind: "language", language: "en", targetLanguage: "ja" },
  },
  {
    expectations: `Cards in US English on first aid that teach how the body works and what standard terms mean (what CPR stands for, why the recovery position keeps the airway open, what a tourniquet does, what shock means), never instructions to follow in an emergency, doses, or treatment advice. Guideline numbers that change between editions (compression rates and depths, ratios) are a never-write. Fewer than 10 cards is fine. Score accuracy at most 6 for any card that tells the learner what to do for an injury or illness.`,
    id: "en-first-aid",
    userInput: { goal: "First aid", kind: "learn", language: "en" },
  },
  {
    expectations: `Cards in Brazilian Portuguese on the stable concepts behind Brazil's tax reform, such as what a value-added tax is, cumulative versus non-cumulative taxes, taxing at the destination versus the origin, the idea of a dual VAT. Score accuracy at most 6 for any card that states rates, dates, the transition schedule, or details that the laws and regulations may still change. Fewer than 10 cards is fine.`,
    id: "pt-reforma-tributaria",
    userInput: { goal: "Reforma tributária brasileira", kind: "learn", language: "pt" },
  },
  {
    expectations: `Cards in US English on what a beginner restoring antique mechanical clocks learns first, such as the escapement, the pendulum and why its length sets the rate, the mainspring, why old oil must be cleaned off before relubricating, the beat. It's a niche subject, so a short deck of true cards is better than 10 with doubtful ones. Penalize made-up historical dates, makers and exact figures.`,
    id: "en-antique-clocks",
    userInput: { goal: "Restoring antique clocks", kind: "learn", language: "en" },
  },
];
