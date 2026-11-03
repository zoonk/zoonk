import { type TestCase } from "@/lib/types";
import { type CheckWarmUpCardsParams } from "@zoonk/ai/tasks/warm-up/check-warm-up-cards";
import { type RawWarmUpCard, toWarmUpCards } from "@zoonk/ai/tasks/warm-up/warm-up-cards";

export type WarmUpCheckInput = Pick<CheckWarmUpCardsParams, "cards" | "goal" | "kind" | "language">;

/** The ids of the cards with a planted error; every other card is clean and should be kept. */
export type WarmUpCheckExpected = { planted: string[] };

type DeckCard = RawWarmUpCard & { planted?: string };

function card(question: string, options: string, reveal: string, planted?: string): DeckCard {
  return {
    options: options
      .split(" / ")
      .map((text) => ({ correct: text.endsWith(" ✓"), text: text.replace(/ ✓$/u, "") })),
    planted,
    question,
    reveal,
  };
}

/** Cards reach the checker after the validator, with its ids and shuffled options. */
function deck({
  cards,
  ...input
}: Omit<WarmUpCheckInput, "cards"> & { cards: DeckCard[] }): Pick<
  TestCase<WarmUpCheckExpected, WarmUpCheckInput>,
  "expected" | "userInput"
> {
  return {
    expected: {
      planted: cards.flatMap((entry, index) => (entry.planted ? [String(index + 1)] : [])),
    },
    userInput: { ...input, cards: toWarmUpCards(cards) },
  };
}

export const TEST_CASES: TestCase<WarmUpCheckExpected, WarmUpCheckInput>[] = [
  {
    id: "en-beekeeping-wrong-key-and-myth",
    ...deck({
      cards: [
        card(
          "Why do beekeepers puff smoke into a hive before opening it?",
          "To put the bees to sleep / To hide the bees' alarm scent ✓ / To warm up the hive",
          "Smoke masks the alarm scent that guard bees release, so fewer bees join in. Many also fill up on honey, which makes them calmer.",
        ),
        card(
          "How many eyes does a honey bee have?",
          "2 ✓ / 5 / 8",
          "Two, one big compound eye on each side of the head.",
          "wrong answer marked right: a honey bee has five eyes",
        ),
        card(
          "Who does almost all the work in a hive: foraging, cleaning and guarding?",
          "Male drones / The queen / Female workers ✓",
          "Female workers. Drones are the males, and their main job is to mate with young queens from other colonies.",
        ),
        card(
          'A bee doing a "waggle dance" in the hive is telling the others…',
          "Where to find food ✓ / That the hive is too hot / That the queen has died",
          "Where to find food. The angle of the dance points the way relative to the sun, and the length of each waggle says how far to fly.",
        ),
        card(
          "What happens to a honey bee worker after it stings?",
          "It always dies ✓ / It grows a new sting / Nothing at all",
          "It always dies, whatever it stings, because its barbed sting tears out of its body.",
          "famous myth: a worker can sting other insects and survive; it dies only when the barbs catch in elastic skin like a mammal's",
        ),
        card(
          "Where does beeswax come from?",
          "Pollen the bees collect / Tree resin / Glands on a worker bee's belly ✓",
          "Young workers make wax in glands on the underside of their abdomen, then chew the flakes into comb. Tree resin becomes propolis, the bees' glue.",
        ),
        card(
          "Nectar turns into honey mostly by…",
          "Mixing with pollen / Losing most of its water ✓ / Fermenting in the comb",
          "Losing water. Bees add enzymes and fan their wings over the cells until the nectar is thick enough, then seal each cell with wax.",
        ),
        card(
          "Who lives longer?",
          "A summer worker / A queen ✓",
          "The queen, by far: she can live for several years. A worker born in summer lives only a few weeks, worn out by foraging.",
        ),
        card(
          "Varroa, a pest every beekeeper learns to check for, is a kind of…",
          "Wasp / Mite ✓ / Fungus",
          "Mite. It's tiny, feeds on bees and spreads viruses, so beekeepers count the mites on a sample of bees to decide when to treat.",
        ),
      ],
      goal: "Beekeeping",
      kind: "learn",
      language: "en",
    }),
  },
  {
    id: "pt-enem-exam-rule-second-answer-stale-number",
    ...deck({
      cards: [
        card(
          "Qual parte da célula vegetal faz a fotossíntese?",
          "Mitocôndria / Cloroplasto ✓ / Ribossomo",
          "O cloroplasto, onde fica a clorofila. A mitocôndria faz quase o caminho inverso: usa glicose e oxigênio para liberar energia.",
        ),
        card(
          "Quantas questões objetivas o Enem tem, somando os dois dias de prova?",
          "90 / 180 ✓ / 200",
          "180: são 45 questões em cada uma das quatro áreas, divididas em dois domingos.",
          "an exam rule: the number of questions is the exam's own fact and can change with each edition",
        ),
        card(
          "Um produto de R$ 80 está com 25% de desconto. Quanto você paga?",
          "R$ 55 / R$ 60 ✓ / R$ 64",
          "R$ 60. 25% é um quarto: um quarto de 80 é 20, e 80 − 20 = 60.",
        ),
        card(
          "O que a Lei Áurea, de 1888, fez?",
          "Proclamou a República / Declarou a independência / Aboliu a escravidão no Brasil ✓",
          "Aboliu a escravidão. A República veio no ano seguinte, em 1889, e a independência foi em 1822.",
        ),
        card(
          "Qual destes é um bioma brasileiro?",
          "Cerrado ✓ / Pampa / Tundra",
          "O Cerrado, a savana que ocupa boa parte do centro do país.",
          "a second right option: the Pampa is also a Brazilian biome",
        ),
        card(
          'Em "Ele correu tanto que ficou sem fôlego", a parte "que ficou sem fôlego" indica…',
          "Consequência ✓ / Causa / Condição",
          'Consequência: ficar sem fôlego é o resultado de correr tanto. A dupla "tanto… que" costuma anunciar essa relação.',
        ),
        card(
          "Por que o gelo boia na água?",
          "Tem ar preso dentro / É menos denso que a água líquida ✓ / É mais frio que a água",
          "Ao congelar, as moléculas de água se organizam num arranjo mais espaçado. O gelo ocupa mais volume com a mesma massa e fica menos denso.",
        ),
        card(
          "Qual é o valor do salário mínimo nacional no Brasil?",
          "R$ 980 / R$ 1.320 ✓ / R$ 2.100",
          "R$ 1.320, o piso que nenhum trabalhador com carteira assinada pode receber abaixo.",
          "a stale number: the minimum wage changes every year and R$ 1.320 was the 2023 value",
        ),
        card(
          "Num dia de sol, por que uma camiseta preta esquenta mais que uma branca?",
          "Absorve mais luz ✓ / Reflete mais luz / Conduz eletricidade",
          "Ela absorve mais luz e transforma essa energia em calor. A branca reflete boa parte da luz que recebe.",
        ),
        card(
          "Uma receita para 4 pessoas usa 3 ovos. Para 8 pessoas, quantos ovos?",
          "6 ✓ / 7 / 12",
          "6. Dobrou o número de pessoas, dobra o de ovos: as duas grandezas são diretamente proporcionais.",
        ),
      ],
      goal: "Enem",
      kind: "exam",
      language: "pt",
    }),
  },
  {
    id: "pt-espanhol-regional-usage-and-contradicting-reveal",
    ...deck({
      cards: [
        card(
          'Em espanhol, "embarazada" quer dizer…',
          "Envergonhada / Grávida ✓ / Cansada",
          'Grávida. Para dizer que está envergonhada, use "avergonzada".',
        ),
        card(
          'Se alguém na Espanha diz que a comida está "exquisita", essa pessoa achou a comida…',
          "Estranha / Deliciosa ✓",
          'Estranha. Em espanhol, "exquisito" é uma crítica, como "esquisito" em português.',
          "a reveal that contradicts its answer: it says 'strange', while the right option is 'delicious', which is correct",
        ),
        card(
          '"Polvo", em espanhol, é…',
          "Povo / O animal de oito braços / Pó ✓",
          'Pó, poeira. O animal se chama "pulpo", e povo é "pueblo".',
        ),
        card(
          'Quem trabalha numa "oficina" na Espanha trabalha num…',
          "Escritório ✓ / Conserto de carros",
          'Escritório. Oficina mecânica, em espanhol, é "taller".',
        ),
        card(
          "Para dizer “pegar o ônibus” em espanhol, se diz…",
          '"Coger el autobús" ✓ / "Agarrar el autobús" / "Llevar el autobús"',
          '"Coger el autobús". É assim em todos os países que falam espanhol.',
          "a regional usage as universal: 'coger' is normal in Spain but vulgar in Mexico and much of Latin America, where people say 'tomar el autobús'",
        ),
        card(
          'Uma "calle larga" é uma rua…',
          "Comprida ✓ / Larga",
          'Comprida. "Largo" fala do comprimento. Para a largura, o espanhol usa "ancho".',
        ),
        card(
          '"Espera un rato" quer dizer…',
          "Cuidado com o rato / Espera um pouco ✓ / Espera rápido",
          'Espera um pouco: "rato", em espanhol, é um tempinho. O bichinho é "ratón".',
        ),
        card(
          '"Me gusta el café", ao pé da letra, é…',
          "Eu gosto do café / O café me agrada ✓",
          '"O café me agrada": em espanhol, o sujeito é o café. Por isso, no plural, fica "me gustan los libros".',
        ),
        card(
          '"Apellido", em espanhol, é…',
          "Sobrenome ✓ / Apelido",
          'Sobrenome. Apelido, em espanhol, é "apodo".',
        ),
      ],
      goal: "Espanhol",
      kind: "language",
      language: "pt",
    }),
  },
  {
    id: "en-psychology-misattributed-quote-and-myth",
    ...deck({
      cards: [
        card(
          "Which part of the nervous system is made of the brain and the spinal cord?",
          "The central nervous system ✓ / The peripheral nervous system",
          "The central nervous system. The nerves that branch out from it to the rest of the body make up the peripheral nervous system.",
        ),
        card(
          "How much of your brain do you actually use?",
          "About 10% ✓ / About half / Nearly all of it",
          "About 10%. The rest sits idle, which is why some people try to unlock it.",
          "famous myth: brain scans show we use virtually all of the brain",
        ),
        card(
          "Neurons pass signals to each other across a tiny gap called a…",
          "Synapse ✓ / Axon / Dendrite",
          "A synapse. The sending neuron releases chemical messengers, called neurotransmitters, that cross the gap.",
        ),
        card(
          "Learning that a behavior leads to a reward, so you do it more often, is called…",
          "Operant conditioning ✓ / Classical conditioning / Habituation",
          "Operant conditioning: behavior is shaped by what follows it. Classical conditioning pairs two signals instead, like a sound and food.",
        ),
        card(
          "Who said “Insanity is doing the same thing over and over and expecting different results”?",
          "Albert Einstein ✓ / Sigmund Freud / B. F. Skinner",
          "Albert Einstein, talking about why people fail to learn from their mistakes.",
          "a misattributed quote: there's no record of Einstein saying it",
        ),
        card(
          "Getting so used to a steady sound, like a fan, that you stop noticing it is called…",
          "Habituation ✓ / Sensitization / Extinction",
          "Habituation. Your brain stops responding to a harmless signal that doesn't change, which frees your attention for new things.",
        ),
        card(
          "Which half of the brain mostly controls your right hand?",
          "The left ✓ / The right",
          "The left. Each half of the brain mostly controls movement on the opposite side of the body.",
        ),
      ],
      goal: "Introductory psychology",
      kind: "learn",
      language: "en",
    }),
  },
  {
    id: "en-kombucha-repeated-idea-and-revealed-answer",
    ...deck({
      cards: [
        card(
          "Sweet tea turns into tangy kombucha thanks to…",
          "Vinegar stirred in at the start / A culture of yeasts and bacteria ✓ / Tea leaves left in too long",
          "A culture of yeasts and bacteria, living in the rubbery disc that floats on top. As they feed on the sugar, they make acids that keep most molds away.",
        ),
        card(
          "The rubbery disc floating on a kombucha brew, called a SCOBY, is…",
          "A layer of mold / A home for microbes ✓ / Leftover bits of tea",
          "A home for microbes: a mat of cellulose the bacteria spin, packed with the yeasts and bacteria that ferment the tea.",
          "a repeated idea: card 1 already taught that yeasts and bacteria living in the floating disc ferment the tea, and its reveal gives this answer away",
        ),
        card(
          "Once kombucha is sealed in a bottle, it gets fizzy because…",
          "The yeasts keep making gas ✓ / The acids react with the glass / Air gets trapped as you pour",
          "The yeasts keep making carbon dioxide. In a sealed bottle the gas can't escape, so it dissolves into the drink and fizzes when you open it.",
        ),
        card(
          "Mold rarely grows on a healthy kombucha brew because the brew is…",
          "Too acidic ✓ / Too cold / Full of caffeine",
          "Too acidic. The acids the culture makes leave little room for mold to take hold.",
          "an answer given away: card 1's reveal already says the culture's acids keep most molds away",
        ),
        card(
          "The caffeine in kombucha comes from…",
          "The tea ✓ / The sugar / The SCOBY",
          "The tea. The culture doesn't make caffeine, so kombucha brewed from black or green tea keeps some of the tea's caffeine.",
        ),
        card(
          "Compared with a cool kitchen, a warm kitchen makes kombucha ferment…",
          "Faster ✓ / Slower",
          "Faster. Yeasts and bacteria work quicker in warmth, so the same brew can turn tangy days sooner.",
        ),
        card(
          "Kombucha jars are covered with cloth instead of a tight lid so the brew gets…",
          "Air the bacteria need ✓ / Light for the culture / A cooler temperature",
          "Air. The bacteria that make kombucha's acids need oxygen, and the cloth still keeps fruit flies out.",
        ),
        card(
          "Brewers let freshly boiled tea cool before adding the culture because tea that hot would…",
          "Kill the culture ✓ / Turn bitter / Burn off the sugar",
          "Kill the culture. Yeasts and bacteria are living things, and tea near boiling is far too hot for them to survive.",
        ),
      ],
      goal: "Brewing kombucha at home",
      kind: "learn",
      language: "en",
    }),
  },
  {
    id: "pt-astronomia-repeated-idea-and-revealed-answer",
    ...deck({
      cards: [
        card(
          "Por que a Lua parece mudar de forma ao longo do mês?",
          "A sombra da Terra a cobre / Vemos partes diferentes do lado iluminado ✓ / Nuvens escondem parte dela",
          "Vemos partes diferentes do lado que o Sol ilumina. A sombra da Terra só cobre a Lua num eclipse lunar.",
        ),
        card(
          "Por que é verão no Brasil quando é inverno na Europa?",
          "O eixo da Terra é inclinado ✓ / O Brasil fica mais perto do Sol / O Sol esquenta mais o sul",
          "O eixo da Terra é inclinado. Em dezembro, o hemisfério sul fica voltado para o Sol e recebe a luz mais de frente e por mais horas.",
        ),
        card(
          "Quanto tempo a luz do Sol leva para chegar até a Terra?",
          "Cerca de 8 segundos / Cerca de 8 minutos ✓ / Cerca de 8 horas",
          "Cerca de 8 minutos. Ou seja, o Sol que você vê no céu é o Sol de 8 minutos atrás.",
        ),
        card(
          "Uma estrela cadente é, na verdade…",
          "Uma estrela caindo / Uma pedrinha entrando na atmosfera ✓ / Um satélite apagando",
          "Uma pedrinha do espaço que entra na atmosfera tão rápido que esquenta e deixa um rastro de luz.",
        ),
        card(
          "Por que da Terra sempre vemos o mesmo lado da Lua?",
          "Ela não gira / Sua rotação acompanha a órbita ✓ / O outro lado está sempre escuro",
          "A gravidade da Terra sincronizou a Lua: ela gira uma vez em torno de si mesma no mesmo tempo em que dá uma volta em torno da Terra.",
        ),
        card(
          "Num eclipse lunar, a Lua escurece porque…",
          "Entra na sombra da Terra ✓ / Passa atrás do Sol / Uma nuvem de poeira a cobre",
          "Ela entra na sombra da Terra. Muitas vezes fica avermelhada, porque a atmosfera da Terra desvia um pouco de luz vermelha até ela.",
          "an answer given away: card 1's reveal already says the Earth's shadow covers the Moon in a lunar eclipse",
        ),
        card(
          "O que causa as estações do ano?",
          "A distância até o Sol / A inclinação do eixo da Terra ✓ / A velocidade da Terra",
          "A inclinação do eixo da Terra. A Terra fica até um pouco mais perto do Sol em janeiro, no verão do hemisfério sul.",
          "a repeated idea: card 2 already asked about the seasons, with the tilt of Earth's axis as its answer",
        ),
        card(
          "Quanto tempo a Terra leva para dar uma volta completa em torno do Sol?",
          "Cerca de 30 dias / Cerca de 365 dias ✓ / Exatamente 360 dias",
          "Cerca de 365 dias e 6 horas. Essas horas que sobram se juntam e viram o 29 de fevereiro dos anos bissextos.",
        ),
      ],
      goal: "Astronomia",
      kind: "learn",
      language: "pt",
    }),
  },
  {
    id: "en-sourdough-related-ideas-all-clean",
    ...deck({
      cards: [
        card(
          "A sourdough starter makes bread rise without store-bought yeast because it's full of…",
          "Wild yeasts ✓ / Baking soda / Trapped air",
          "Wild yeasts, along with bacteria, that live in flour. Regular feedings of flour and water keep them active and multiplying.",
        ),
        card(
          "Why do bakers slash the top of a loaf just before it goes in the oven?",
          "To let trapped air out / To choose where it bursts open ✓ / To help the middle cook",
          "To choose where it opens. The loaf swells fast in the oven, and a shallow cut gives it a weak spot to expand from instead of tearing at random.",
        ),
        card(
          "Kneading dough mostly builds…",
          "Gluten ✓ / Sugar / Yeast",
          "Gluten, a stretchy web of proteins from the flour. It traps the gas the yeast makes, which lets the dough rise and hold its shape.",
        ),
        card(
          "For the first minutes of baking, bakers fill the oven with steam so the crust…",
          "Stays soft while the loaf rises ✓ / Browns sooner / Grows thicker",
          "Stays soft. A moist surface can keep stretching, so the loaf rises higher before the crust sets.",
        ),
        card(
          "Bread goes stale fastest when you keep it in the…",
          "Fridge ✓ / Freezer / Bread box",
          "Fridge. Cold speeds up the way the starch in bread firms up, so a loaf stales faster there than on the counter.",
        ),
        card(
          "Made the same way, a loaf of whole wheat flour usually rises…",
          "Less than a white loaf ✓ / More than a white loaf",
          "Less. The bran in whole wheat flour gets in the way of the gluten web, so the dough traps less gas.",
        ),
        card(
          "The deep brown color and roasty flavor of a bread crust come mostly from…",
          "Browning reactions in the heat ✓ / Burnt flour / Oil brushed on top",
          "Browning reactions between sugars and proteins on the hot surface, the same kind that give toast and roasted coffee their flavor.",
        ),
        card(
          "Besides adding flavor, salt in bread dough…",
          "Slows the yeast down ✓ / Feeds the yeast / Makes the dough rise faster",
          "Slows the yeast down, which keeps the rise steady. Salt also tightens the gluten, so the dough is easier to shape.",
        ),
      ],
      goal: "Baking sourdough bread",
      kind: "learn",
      language: "en",
    }),
  },
  {
    id: "pt-fotografia-related-ideas-all-clean",
    ...deck({
      cards: [
        card(
          "Num retrato, abrir bem o diafragma, com um número f baixo como f/1.8, deixa o fundo…",
          "Mais desfocado ✓ / Mais nítido / Mais escuro",
          "Mais desfocado. Quanto maior a abertura, mais estreita a faixa da cena que fica em foco, e o fundo vira um borrão suave.",
        ),
        card(
          "Para congelar um carro passando rápido, o tempo do obturador precisa ser…",
          "Mais curto ✓ / Mais longo",
          "Mais curto, como 1/1000 s. O sensor recebe luz por tão pouco tempo que o carro quase não se move na foto.",
        ),
        card(
          "Subir o ISO deixa a foto mais clara, mas também aumenta…",
          "O ruído ✓ / O desfoque / A saturação",
          "O ruído, aqueles grãozinhos coloridos. A câmera amplifica o sinal do sensor, e o ruído é amplificado junto.",
        ),
        card(
          "A regra dos terços sugere colocar o assunto principal…",
          "Bem no centro / Fora do centro ✓ / Na borda da foto",
          "Fora do centro, sobre uma das linhas que dividem a foto em três partes. Assim a imagem costuma ficar mais viva que com tudo no meio.",
        ),
        card(
          "A luz da hora dourada, perto do nascer e do pôr do sol, tem um tom…",
          "Alaranjado ✓ / Azulado / Esverdeado",
          "Alaranjado. Com o Sol baixo, a luz atravessa mais atmosfera, que espalha boa parte do azul antes de chegar até nós.",
        ),
        card(
          "Comparada com uma lente de 24 mm, uma de 200 mm mostra…",
          "Um pedaço menor da cena ✓ / Um pedaço maior da cena",
          "Um pedaço menor, mais ampliado. Quanto maior a distância focal, mais estreito o ângulo de visão.",
        ),
        card(
          "Comparado com um JPEG, um arquivo RAW da mesma foto guarda…",
          "Mais dados do sensor ✓ / Menos detalhes da cena / Os mesmos dados, só maior",
          "Mais dados do sensor. Por isso o arquivo fica maior e aguenta mais ajustes de luz e cor na edição.",
        ),
      ],
      goal: "Fotografia",
      kind: "learn",
      language: "pt",
    }),
  },
];
