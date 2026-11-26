import { type CefrLevel } from "@zoonk/utils/cefr";
import { type SeedLevelTest } from "../types";

type Skill = "listening" | "reading";

type Passage = { passage: string; question: string };

function question(
  level: CefrLevel,
  skill: Skill,
  number: number,
  { answerIndex, options, ...passage }: Passage & { answerIndex: number; options: string[] },
): SeedLevelTest["questions"][number] {
  return {
    answerIndex,
    id: `seed-${skill}-${level.toLowerCase()}-${number}`,
    level,
    options,
    skill,
    ...passage,
  };
}

function sumCodePoints(text: string): number {
  return Array.from({ length: text.length }, (_, index) => text.codePointAt(index) ?? 0).reduce(
    (total, code) => total + code,
    0,
  );
}

/** Ordered the way the app's writer orders them, so the right options don't sit together. */
function confirmation(
  level: CefrLevel,
  skill: Skill,
  number: number,
  { right, wrong, ...passage }: Passage & { right: string[]; wrong: string[] },
): SeedLevelTest["confirmations"][number] {
  const options = [...right, ...wrong].toSorted(
    (first, second) =>
      sumCodePoints(`${passage.passage}${first}`) - sumCodePoints(`${passage.passage}${second}`),
  );

  return {
    answerIndices: options.flatMap((option, index) => (right.includes(option) ? [index] : [])),
    id: `seed-confirmation-${skill}-${level.toLowerCase()}-${number}`,
    level,
    options,
    skill,
    ...passage,
  };
}

const questions = [
  question("A1", "reading", 1, {
    answerIndex: 1,
    options: ["2,50 dólares", "3 dólares", "6 dólares", "7 dólares"],
    passage: "Maple Café. Open every day, 7 a.m. to 6 p.m. Coffee $3. Muffins $2.50.",
    question: "Quanto custa um café?",
  }),
  question("A1", "reading", 2, {
    answerIndex: 2,
    options: [
      "No domingo, 3 de maio",
      "Na terça-feira, 5 de maio",
      "Na segunda-feira, 4 de maio",
      "No sábado, 2 de maio",
    ],
    passage:
      "TTC day pass. Valid for one day, all buses and subways. Price: $13.50. Date: Monday, May 4.",
    question: "Em que dia o passe vale?",
  }),
  question("A1", "reading", 3, {
    answerIndex: 3,
    options: ["No sábado", "Na segunda-feira", "Na sexta-feira", "No domingo"],
    passage:
      "City Pharmacy. Monday to Friday: 9 a.m. to 9 p.m. Saturday: 10 a.m. to 5 p.m. Sunday: closed.",
    question: "Em que dia a farmácia fica fechada?",
  }),
  question("A1", "listening", 1, {
    answerIndex: 0,
    options: ["Ao lado do banco", "Em frente ao banco", "Dentro do banco", "Longe do banco"],
    passage:
      "Hi, it's Ana. The library is next to the bank, on King Street. See you there at four!",
    question: "Onde fica a biblioteca?",
  }),
  question("A1", "listening", 2, {
    answerIndex: 2,
    options: ["Perto da porta", "No balcão", "Perto da janela", "Do lado de fora"],
    passage: "Hey, it's Tom. I'm at the café now. I have a red jacket. Come in, I'm by the window.",
    question: "Onde Tom está no café?",
  }),
  question("A1", "listening", 3, {
    answerIndex: 1,
    options: [
      "Até as duas da tarde",
      "Até as oito da noite",
      "Até as sete da noite",
      "Até as nove da noite",
    ],
    passage:
      "Attention, shoppers. Today, all apples are two dollars a bag. The store closes at eight tonight.",
    question: "Até que horas a loja fica aberta hoje?",
  }),
  question("A2", "reading", 1, {
    answerIndex: 3,
    options: [
      "Foram de carro e voltaram no domingo à noite",
      "Foram de trem e voltaram na sexta à noite",
      "Foram de trem e ficaram até a segunda",
      "Foram de trem e voltaram no domingo à noite",
    ],
    passage:
      "Hi Paula! We're back from Montreal. We took the train on Friday and came home on Sunday night. The hotel was small, but the food was great. Next time, come with us!",
    question: "Como foi a viagem para Montreal?",
  }),
  question("A2", "reading", 2, {
    answerIndex: 0,
    options: [
      "Custa 900 dólares com as contas e fica livre em 1º de junho",
      "Custa 900 dólares mais as contas e fica livre em 1º de junho",
      "Custa 900 dólares com as contas e tem banheiro só seu",
      "Custa 900 dólares com as contas e aceita animais",
    ],
    passage:
      "Room for rent near Dufferin station. $900 a month, utilities included. Shared kitchen and bathroom. No pets, please. Available from June 1. Call Mike after 6 p.m.",
    question: "O que o anúncio diz sobre o quarto?",
  }),
  question("A2", "reading", 3, {
    answerIndex: 2,
    options: [
      "O lugar: agora é em outro restaurante, na sexta",
      "O dia: agora é na quarta, no mesmo restaurante",
      "O dia: agora é na sexta, no mesmo restaurante",
      "O horário: agora é às 7, ainda na quinta",
    ],
    passage:
      "Hi everyone, the team dinner is not on Thursday anymore. It's on Friday at 7, at the same restaurant on Queen Street. Please tell me by Wednesday if you can come. Thanks, Lisa",
    question: "O que mudou no jantar da equipe?",
  }),
  question("A2", "listening", 1, {
    answerIndex: 1,
    options: [
      "Ir na segunda às 10h30 e levar o cartão de saúde",
      "Ir na terça às 10h30 e levar o cartão de saúde",
      "Ir na terça às 10h30 e ligar antes para confirmar",
      "Ir na terça às 10h e levar o cartão de saúde",
    ],
    passage:
      "Hello, this is Dr. Chen's office calling for Paulo Souza. Your appointment is now on Tuesday at ten thirty, not Monday. Please bring your health card. Call us back if that time doesn't work.",
    question: "O que a clínica pede a Paulo?",
  }),
  question("A2", "listening", 2, {
    answerIndex: 3,
    options: [
      "Almoçam ao meio-dia",
      "Voltam para a cidade",
      "Pegam o barco às quatro",
      "Caminham na praia",
    ],
    passage:
      "Hi! On Saturday morning we're going to the island by ferry. First we walk on the beach, then we have lunch at noon. We're back in the city around four. Want to come?",
    question: "O que eles fazem primeiro na ilha?",
  }),
  question("A2", "listening", 3, {
    answerIndex: 0,
    options: [
      "Um encanador vem amanhã cedo e você não precisa estar em casa",
      "Um encanador vem amanhã cedo e você precisa abrir a porta",
      "Um encanador vem hoje às onze e você não precisa estar em casa",
      "Um encanador vem amanhã cedo para consertar a pia do banheiro",
    ],
    passage:
      "Hi, it's Robert, your landlord. Tomorrow morning a plumber is coming to fix the kitchen sink. He'll be there between nine and eleven. You don't need to be home, I have a key.",
    question: "O que o proprietário avisa?",
  }),
  question("B1", "reading", 1, {
    answerIndex: 2,
    options: [
      "Porque Jenna ainda trabalha no hotel",
      "Porque Jenna só começa daqui a duas semanas",
      "Para Jenna ter tempo de aprender os sistemas",
      "Porque Jenna tem pouca experiência com pessoas",
    ],
    passage:
      "Hi team, Starting next Monday, Jenna Park joins us as our new office manager. She worked for five years at a hotel downtown, so she knows a lot about helping people quickly. For her first two weeks, please send all supply requests to me, not to her, so she has time to learn our systems. Thanks, David",
    question: "Por que David pede que os pedidos de material vão para ele por duas semanas?",
  }),
  question("B1", "reading", 2, {
    answerIndex: 1,
    options: [
      "Porque o curso agora é gratuito",
      "Porque alunos disseram que falavam pouco",
      "Porque há menos alunos novos na cidade",
      "Porque as aulas agora são só à noite",
    ],
    passage:
      "Evening English classes at the Bloor Community Center start again in September. Classes meet twice a week, on Tuesdays and Thursdays from 6:30 to 8:30. This year the groups are smaller, with a maximum of twelve students, because last year many students said they didn't get enough time to speak. The course is free for new residents of Toronto.",
    question: "Por que as turmas deste ano são menores?",
  }),
  question("B1", "reading", 3, {
    answerIndex: 0,
    options: [
      "Gostou, apesar do vento frio",
      "Se arrependeu, porque estava frio demais",
      "Acha que o verão teria sido melhor",
      "Achou os hotéis caros para a época",
    ],
    passage:
      "Last weekend I finally visited Niagara Falls. Everyone told me to go in summer, but I went in March and I'm glad I did. There were almost no tourists, the hotels were cheap, and the ice around the falls looked amazing. The only problem was the wind: it was so cold that I could only stay outside for twenty minutes at a time.",
    question: "O que o autor acha de ter ido em março?",
  }),
  question("B1", "listening", 1, {
    answerIndex: 3,
    options: [
      "O voo atrasou, mas ele chega para o jantar",
      "O voo foi cancelado e ele perde a reunião",
      "O voo foi cancelado e ele volta para casa",
      "O voo foi cancelado e ele viaja amanhã cedo",
    ],
    passage:
      "Hi, it's me. Bad news: my flight to Vancouver is canceled because of the snow. The airline put me on the first flight tomorrow morning, and they're paying for a hotel near the airport tonight. So I won't make it to dinner, but I'll be there for the meeting on Thursday. I'll call you when I land.",
    question: "Qual é a principal notícia da mensagem?",
  }),
  question("B1", "listening", 2, {
    answerIndex: 1,
    options: [
      "É preciso correr rápido para acompanhar o grupo",
      "Ninguém se importa com a velocidade de cada um",
      "Os encontros são às quartas à noite",
      "O café depois é a parte de que ela menos gosta",
    ],
    passage:
      "Hey, it's Carla. I joined the running club at the park, and you should come too. We meet every Wednesday at seven in the morning. I was worried I'd be too slow, but nobody cares about speed. People just run together and chat. Afterward we get coffee, which is honestly my favorite part.",
    question: "O que Carla diz sobre o clube de corrida?",
  }),
  question("B1", "listening", 3, {
    answerIndex: 2,
    options: [
      "Para os gerentes responderem pelo e-mail",
      "Para ninguém precisar avisar o gerente",
      "Para os pedidos ficarem todos num só lugar",
      "Para os pedidos chegarem só ao gerente",
    ],
    passage:
      "Hi, quick update about vacation requests. From now on, you don't send an email to your manager. You fill out the form on the company website at least two weeks before. Your manager gets a notification and answers there. This way, all requests are in one place and nothing gets lost in someone's inbox.",
    question: "Por que a empresa mudou o jeito de pedir férias?",
  }),
  question("B2", "reading", 1, {
    answerIndex: 3,
    options: [
      "Proibir o uso da lavanderia sem reserva",
      "Anunciar máquinas novas na lavanderia",
      "Reclamar de roupas deixadas na mesa",
      "Organizar melhor o uso da lavanderia",
    ],
    passage:
      "Dear residents, As many of you know, the laundry room on the ground floor has been busy on weekends. Starting this month, you can reserve a two-hour slot online. Walk-in use is still possible when a machine is free, but reserved slots come first. We have also noticed clothes left in machines for hours after a cycle ends. Please collect your laundry promptly; items left over thirty minutes may be moved to the folding table.",
    question: "Qual é o principal objetivo do aviso?",
  }),
  question("B2", "reading", 2, {
    answerIndex: 0,
    options: [
      "Achou bonito, mas não vale o preço da refeição",
      "Adorou e pretende voltar para jantar de novo",
      "Detestou tudo, inclusive o atendimento",
      "Achou a comida ótima, mas o lugar sem graça",
    ],
    passage:
      "I had high hopes for Harbor Kitchen on Queens Quay after all the buzz online. The room is gorgeous, and the staff clearly know the menu well. The fish arrived beautifully plated, if a little small for thirty-two dollars. Dessert took forty minutes to arrive, and our server apologized twice. Would I go back? Maybe for a drink at the bar, where the view is the same and the bill is not.",
    question: "Qual é a atitude do autor em relação ao restaurante?",
  }),
  question("B2", "reading", 3, {
    answerIndex: 2,
    options: [
      "As pistas custam caro e deveriam fechar mais cedo",
      "As pistas deveriam cobrar entrada de quem patina",
      "As pistas valem o custo porque unem a vizinhança",
      "As pistas atendem sobretudo jovens e aposentados",
    ],
    passage:
      "Every winter, the city debates whether to keep outdoor skating rinks open longer. Critics point to the cost of staff and ice machines. But a rink is one of the few places where a new immigrant, a retired teacher and a group of teenagers share the same space for free. If we measure it only by the cost per skater, we miss what we are actually paying for: a reason for neighbors to meet in the coldest months of the year.",
    question: "Qual é o argumento principal do texto?",
  }),
  question("B2", "listening", 1, {
    answerIndex: 1,
    options: [
      "Ainda está irritada com as obras do verão",
      "Está satisfeita, mas tem dúvidas sobre o inverno",
      "Acha que o metrô continua sendo mais rápido",
      "Tem certeza de que funcionam o ano todo",
    ],
    passage:
      "So the new bike lanes on Bloor are finally finished. I'll admit I was one of the people complaining about the construction all summer. But I've been cycling to work for two weeks now, and I'm getting there ten minutes faster than by subway. My only worry is winter. Ask me again in January, when the lanes are covered in snow.",
    question: "Como a pessoa se sente em relação às ciclovias agora?",
  }),
  question("B2", "listening", 2, {
    answerIndex: 0,
    options: [
      "Para pedir que Sam aceite dividir o canteiro",
      "Para avisar que Sam ficou sem canteiro este ano",
      "Para pedir ajuda para regar a horta na sexta",
      "Para convidar Sam a se inscrever na horta",
    ],
    passage:
      "Hi Sam, it's Diane from the community garden. I'm calling everyone who signed up for a plot this year. We had more requests than space, so we're asking people to share. You'd split a plot with another family and take turns watering. I know it's not what you expected, but it means nobody gets left out. Let me know by Friday if that works for you.",
    question: "Por que Diane está ligando?",
  }),
  question("B2", "listening", 3, {
    answerIndex: 3,
    options: [
      "Usar cupons é a melhor forma de economizar",
      "Pedir comida pronta às quartas sai mais barato",
      "Comprar no domingo sai mais barato que na quarta",
      "Planejar as refeições economiza mais que cupons",
    ],
    passage:
      "People always ask me how to save money on groceries, and they expect a list of coupons. Honestly, coupons barely matter. What changed my budget was boring: I plan five dinners on Sunday and buy only what those meals need. When I skip the plan, I end up ordering takeout by Wednesday, and that single habit costs more than any coupon saves.",
    question: "Qual é a ideia principal do que a pessoa diz?",
  }),
  question("C1", "reading", 1, {
    answerIndex: 2,
    options: [
      "O acervo é excelente, mas o prédio é feio por fora",
      "Tudo decepciona, inclusive a sala de fotografia",
      "O prédio impressiona, mas a exposição em geral decepciona",
      "É um museu que vale a pena visitar várias vezes",
    ],
    passage:
      "The museum's new wing has been described as bold, and it certainly is: a glass box bolted onto a Victorian brick building, glowing at night like a lantern. Inside, though, the boldness thins out. The galleries are spacious but strangely quiet, as if the curators were afraid the art might compete with the architecture. A handful of rooms work beautifully, particularly the one devoted to local photographers. Elsewhere, you find yourself admiring the ceiling more than the walls. It is a building worth visiting; whether it is a museum worth revisiting is another question.",
    question: "Qual é a opinião do autor sobre a nova ala?",
  }),
  question("C1", "reading", 2, {
    answerIndex: 0,
    options: [
      "Admite a falha, mas sugere que atrasos em horário de pico acontecem",
      "Nega que o pedido tenha chegado frio ou atrasado",
      "Diz que o gerente da loja vai ligar para a cliente",
      "Oferece devolver todo o valor pago no pedido",
    ],
    passage:
      "Dear Ms. Alvarez, Thank you for taking the time to share your experience at our Yonge Street location. We were sorry to read that your order arrived cold and forty minutes late. While delays can occur during peak hours, we recognize that this falls short of the standard we set for ourselves. We have shared your comments with the store manager. As a gesture of goodwill, we have added a credit of fifteen dollars to your account, which will be applied automatically to your next order. We hope to have the opportunity to serve you better.",
    question: "O que a empresa deixa implícito na resposta?",
  }),
  question("C1", "reading", 3, {
    answerIndex: 1,
    options: [
      "O trabalho remoto é melhor e os executivos estão errados",
      "Os dois lados têm parte da razão, e as regras devem pesar ambos",
      "O escritório é melhor porque permite aprender com os colegas",
      "O debate já foi resolvido a favor do trabalho remoto",
    ],
    passage:
      "Five years after offices emptied out, the debate about remote work has settled into two camps that rarely listen to each other. Executives cite lost spontaneity; employees cite lost commutes. Both are describing something real. What gets less attention is who benefits from each arrangement. Remote work has opened jobs to parents, disabled workers and people in smaller towns, yet the informal mentoring that once happened by the coffee machine has not moved online with them. Any policy that ignores either fact is less a solution than a preference dressed up as one.",
    question: "Qual é a posição do autor?",
  }),
  question("C1", "listening", 1, {
    answerIndex: 3,
    options: [
      "É contra as torres porque prefere terrenos vazios",
      "Acha que as torres já resolveram o problema do preço",
      "Quer que as torres sejam só para professores e enfermeiros",
      "Apoia as obras, mas não as vê como solução para o preço",
    ],
    passage:
      "Look, I'm not against the new condo towers downtown. The city needs housing, and I'd rather see cranes than empty lots. What bothers me is that we keep calling them a solution to affordability when the smallest units start at six hundred thousand dollars. They'll help, eventually, by easing pressure elsewhere. But if we want teachers and nurses living in the neighborhoods they serve, towers alone won't get us there, and pretending otherwise just delays the harder conversation.",
    question: "Qual é a posição do comentarista sobre as torres?",
  }),
  question("C1", "listening", 2, {
    answerIndex: 2,
    options: [
      "Irritado, culpando o amigo pelo tempo perdido",
      "Entusiasmado, sem nenhuma crítica à experiência",
      "Bem-humorado, com uma ironia leve sobre a dica",
      "Triste, porque o grupo não conseguiu sair a tempo",
    ],
    passage:
      "Hey, so I finally went to that escape room you've been recommending for months. Great call. We spent the first twenty minutes trying to open a drawer that, it turns out, was just decoration. Then Kevin found the actual clue by leaning on a wall. We got out with thirty seconds to spare, which I'm choosing to call a victory. Anyway, I owe you one, though I'm not entirely sure whether that's a thank-you or a threat.",
    question: "Qual é o tom da mensagem sobre a sala de fuga?",
  }),
  question("C1", "listening", 3, {
    answerIndex: 0,
    options: [
      "Tem origem comercial, mas andar mais ainda faz bem",
      "É inútil, porque começou como propaganda",
      "É o mínimo necessário para ter algum benefício",
      "Quem anda seis mil passos já pode parar por aí",
    ],
    passage:
      "The ten-thousand-steps target started, as far as anyone can tell, as a marketing slogan for a pedometer. That doesn't make it useless. Studies do show real benefits from walking more, but most of the gain comes well before ten thousand, somewhere around seven. So if you're hitting six thousand and feeling like a failure, I'd say you're closer to the finish line than the number on your watch suggests. Just don't stop there because of me.",
    question: "O que o médico pensa da meta de dez mil passos?",
  }),
  question("C2", "reading", 1, {
    answerIndex: 1,
    options: [
      "Que os trens passaram a chegar sem atrasos",
      "Que o órgão disfarçou os atrasos em vez de resolvê-los",
      "Que os passageiros gostam de ter mais tempo para ler",
      "Que as novas melhorias devem chegar logo e no prazo",
    ],
    passage:
      "Good news for commuters: the transit authority has announced that the Line 1 delays, which have plagued riders since spring, are now officially part of the schedule. Trains that once arrived late will henceforth arrive precisely when the new timetable predicts, which is to say late, but punctually so. Officials describe this as a 'realignment of expectations', a phrase that has the great advantage of requiring no new trains. Riders are encouraged to use the extra time productively. Several have reportedly finished novels; one claims to have learned Portuguese between Bloor and Union. The authority, for its part, has promised further improvements, and given its record, there is every reason to expect they will arrive on schedule.",
    question: "O que o autor realmente quer dizer?",
  }),
  question("C2", "reading", 2, {
    answerIndex: 3,
    options: [
      "Que as notas dos alunos sobem com menos dias de aula",
      "Que os professores ficam mais felizes trabalhando menos",
      "Que os programas-piloto esconderam resultados ruins",
      "Que toda família tem como cuidar dos filhos no quinto dia",
    ],
    passage:
      "Advocates of the four-day school week tend to frame it as a gift of time: a long weekend for rest, family and the activities children never seem to fit in. The pilot programs they cite report happier teachers and steady test scores, and there is no reason to doubt either finding. Yet the argument quietly depends on what happens on that fifth day. For a family with a parent at home, or the means to pay for a camp, the extra day is indeed a gift. For a family where both parents work shifts, it is a childcare problem that arrives every single week. The question is not whether the policy works, but for whom it was imagined.",
    question: "Que pressuposto o autor aponta no argumento a favor da semana de quatro dias?",
  }),
  question("C2", "reading", 3, {
    answerIndex: 0,
    options: [
      "Lembra queixas antigas que viraram uso comum, mas faz uma ressalva",
      "Defende que toda mudança na língua acaba sendo uma melhoria",
      "Usa cartas de jornais para provar que os jovens falam pior",
      "Compara séculos para mostrar que as normas não servem para nada",
    ],
    passage:
      "Every generation discovers, with fresh alarm, that young people are ruining the language. The complaints change; the structure does not. In the eighteenth century it was contractions, later it was split infinitives, and now it is the habit of ending sentences with 'like' or turning nouns into verbs. What the critics rarely notice is that their own speech was once the scandal. 'Contact' as a verb drew furious letters to newspapers in the 1920s; today it appears in every company email. None of this means that all change is improvement, or that standards are pointless. It means that a usage being new is, on its own, no evidence that it is wrong.",
    question: "Como o autor constrói o argumento?",
  }),
  question("C2", "listening", 1, {
    answerIndex: 2,
    options: [
      "Era injusta com quem discordava dela",
      "Era gentil e nunca dizia nada difícil",
      "Era dura, mas justa, e ele demorou a valorizar isso",
      "Ele sempre admirou abertamente o jeito dela",
    ],
    passage:
      "I've been asked to say a few words about Margaret, which is a little like being asked to summarize the ocean in a postcard. She ran this department for twenty-two years, and I'd be lying if I said every one of those years was easy. She could be blunt to the point of terrifying. But I have never once known her to be unfair, and I've come to think that's the rarer quality. Most of us in this room owe her at least one career-saving conversation we didn't want to have at the time. So, to Margaret: thank you, and I mean that more than I'd have admitted ten years ago.",
    question: "O que o orador sugere sobre Margaret?",
  }),
  question("C2", "listening", 2, {
    answerIndex: 1,
    options: [
      "Elogia o plano por ser cuidadoso e bem detalhado",
      "Ironiza o plano como mais adiamento disfarçado de cuidado",
      "Acha que repintar as faixas vai resolver o trânsito",
      "Concorda com os críticos, mas defende o prefeito",
    ],
    passage:
      "And in tonight's top story, the city has unveiled its new plan to reduce traffic downtown: a forty-page report recommending that a committee be formed to study the findings of last year's committee. Critics have called it an exercise in delay. The mayor's office prefers the word 'thorough'. In fairness, the report does contain one concrete proposal, which is to repaint the lane markings on Spadina. Asked when the new committee might report back, a spokesperson said only that these things take the time they take. Drivers stuck there this evening will no doubt find that enormously reassuring.",
    question: "Qual é a atitude do apresentador em relação ao plano?",
  }),
  question("C2", "listening", 3, {
    answerIndex: 3,
    options: [
      "Mostra que obras novas sempre levam alguns anos",
      "Defende que a cidade pare de construir estradas",
      "Diz que dirigir ficou mais caro e mais lento",
      "Aponta que a ideia supõe um número fixo de motoristas",
    ],
    passage:
      "We often hear that a city can build its way out of congestion: add a lane, and traffic flows. The evidence from the last fifty years is fairly consistent, and it isn't kind to that idea. New lanes fill up within a few years, because cheaper, faster driving invites more of it. Now, notice what the 'just add a lane' argument takes for granted: that the number of drivers is fixed, a quantity we simply have to accommodate. Once you drop that assumption, the question changes from how much road we need to what kind of travel we want to encourage.",
    question: "O que a pessoa faz para questionar a ideia de abrir mais faixas?",
  }),
];

const confirmations = [
  confirmation("A1", "reading", 1, {
    passage:
      "Found: a black wallet on the bus, Friday. Now at the front desk. Come between 9 and 5.",
    question: "O que o aviso diz?",
    right: ["A carteira é preta", "Foi achada no ônibus", "Está na recepção"],
    wrong: ["Foi achada no sábado", "Dá para buscar só até as 9", "A carteira é marrom"],
  }),
  confirmation("A1", "reading", 2, {
    passage:
      "City Pool. Swim lessons: Monday and Wednesday, 5 p.m. Free swim: Saturday, 10 a.m. Closed Sunday.",
    question: "O que é verdade sobre a piscina?",
    right: ["Tem aula de natação na segunda", "Fecha no domingo", "O nado livre é no sábado"],
    wrong: ["Tem aula de natação no sábado", "O nado livre é às 5 da tarde"],
  }),
  confirmation("A1", "listening", 1, {
    passage:
      "Hello, this is the clinic. Your appointment is on Thursday at two. Please come ten minutes early.",
    question: "O que a recepcionista diz?",
    right: ["A consulta é na quinta", "A consulta é às duas", "É para chegar dez minutos antes"],
    wrong: ["A consulta é na terça", "É para chegar dez minutos depois"],
  }),
  confirmation("A1", "listening", 2, {
    passage:
      "Hi, I have a package for apartment 4B. Nobody is home, so I'm leaving it with your neighbor in 4A.",
    question: "O que o entregador diz?",
    right: [
      "O pacote é para o apartamento 4B",
      "Não tem ninguém em casa",
      "O vizinho do 4A ficou com o pacote",
    ],
    wrong: ["Ele deixou o pacote na porta", "Ele volta amanhã com o pacote"],
  }),
  confirmation("A2", "reading", 1, {
    passage:
      "Bloor Cinema this week. Friday: 'The Long Road' at 7 p.m. and 9:30 p.m. Saturday: family film 'Snow Dogs' at 2 p.m., tickets half price for kids. Sunday: closed for a private event.",
    question: "O que é verdade sobre a programação?",
    right: [
      "Há duas sessões de 'The Long Road' na sexta",
      "Crianças pagam metade no filme de sábado",
      "No domingo há um evento fechado",
    ],
    wrong: [
      "O filme de família passa na sexta à noite",
      "O cinema abre no domingo para todos",
      "Todos os ingressos de sábado custam metade",
    ],
  }),
  confirmation("A2", "reading", 2, {
    passage:
      "Hi! I'm Jo from 3C. We're having a small party on Saturday night, from eight to around eleven. Sorry about the noise. If it's too loud, just knock on my door. Thanks!",
    question: "O que a vizinha diz no bilhete?",
    right: [
      "A festa é no sábado à noite",
      "Ela pede desculpas pelo barulho",
      "Dá para bater na porta dela se incomodar",
    ],
    wrong: ["A festa vai só até as oito", "Ela convida você para a festa"],
  }),
  confirmation("A2", "listening", 1, {
    passage:
      "Hello parents, this is Ms. Grant from Riverside School. Our spring concert is next Thursday at six in the gym. The children should arrive at five thirty in white shirts. Parking is behind the school.",
    question: "O que a professora avisa?",
    right: [
      "O concerto é na quinta que vem",
      "As crianças devem chegar às cinco e meia",
      "As crianças vão de camisa branca",
    ],
    wrong: [
      "O concerto é no teatro da cidade",
      "O estacionamento fica na frente da escola",
      "Os pais devem chegar às cinco e meia",
    ],
  }),
  confirmation("A2", "listening", 2, {
    passage:
      "Hi, this is Maria at Studio Nine. You called about a haircut on Saturday. We're full that day, but we have a spot on Friday at four. It's forty dollars. Call me back to book it.",
    question: "O que o salão diz?",
    right: [
      "Não há horário livre no sábado",
      "Há um horário na sexta às quatro",
      "É preciso ligar de volta para marcar",
    ],
    wrong: ["O corte custa quatorze dólares", "O horário de sexta já está marcado"],
  }),
  confirmation("B1", "reading", 1, {
    passage:
      "I started learning the guitar at forty-five, and I want to share what helped. First, I stopped trying to learn songs I loved and started with simple ones I could actually finish. Second, I practice fifteen minutes every day instead of two hours on Sunday. My fingers hurt a lot in the first month, but that passes. Honestly, my only regret is not starting sooner.",
    question: "O que o autor diz sobre aprender violão?",
    right: [
      "Praticar um pouco todo dia funcionou melhor",
      "Começar com músicas simples ajudou",
      "Ele se arrepende de não ter começado antes",
    ],
    wrong: [
      "Ele treina duas horas todo domingo",
      "A dor nos dedos nunca passou",
      "Ele aprendeu primeiro as músicas favoritas",
    ],
  }),
  confirmation("B1", "reading", 2, {
    passage:
      "Kensington Market is one of Toronto's most colorful neighborhoods. You'll find vintage clothing, food from dozens of countries and street art on almost every wall. It's best to visit on foot, since parking is very hard to find. On the last Sunday of each summer month, the streets close to cars and fill with music. Bring cash, because some small shops don't take cards.",
    question: "O que o guia diz sobre Kensington Market?",
    right: [
      "É melhor visitar o bairro a pé",
      "Algumas lojas pequenas não aceitam cartão",
      "Tem comida de muitos países",
    ],
    wrong: ["É fácil estacionar perto do mercado", "As ruas fecham todo domingo do ano"],
  }),
  confirmation("B1", "listening", 1, {
    passage:
      "Okay, everyone, listen up. We lost today, but I'm not disappointed. Our defense was much better than last week. What we need to work on is passing; we gave the ball away too often in the second half. Practice on Tuesday is moved to six thirty because the field is busy earlier. And great job, Priya, on that goal.",
    question: "O que o técnico diz?",
    right: [
      "A defesa melhorou em relação à semana passada",
      "O time precisa treinar os passes",
      "O treino de terça mudou para as seis e meia",
    ],
    wrong: [
      "Ele está decepcionado com a derrota",
      "O time errou mais passes no primeiro tempo",
      "Priya teve problemas na defesa",
    ],
  }),
  confirmation("B1", "listening", 2, {
    passage:
      "Hey, about your interview tomorrow. Don't try to memorize answers; they always sound fake. Instead, think of two or three real stories from your last job that show how you solve problems. Get there fifteen minutes early, but don't go in before ten minutes to the hour. And at the end, ask them a question. It shows you're actually interested.",
    question: "Que conselhos a amiga dá?",
    right: [
      "Pensar em histórias reais do último emprego",
      "Fazer uma pergunta no fim da entrevista",
      "Chegar ao local quinze minutos antes",
    ],
    wrong: ["Decorar as respostas mais comuns", "Entrar na sala quinze minutos antes"],
  }),
  confirmation("B2", "reading", 1, {
    passage:
      "Volunteering is often sold as a way to pad a résumé, and employers do notice it. But in my experience the real benefit is quieter. Spending Saturday mornings at a food bank taught me more about my own city than ten years of living in it. I met people whose lives looked nothing like mine, and a few of them became friends. If you volunteer only for the line on your résumé, you'll probably quit within months. If you go to learn something, you might stay for years.",
    question: "O que o texto dá a entender?",
    right: [
      "O autor valoriza mais o que aprendeu que o currículo",
      "Quem pensa só no currículo tende a desistir cedo",
      "O voluntariado aproximou o autor de gente diferente",
    ],
    wrong: [
      "Os empregadores não ligam para trabalho voluntário",
      "O autor trabalha no banco de alimentos durante a semana",
      "O voluntariado serve sobretudo para conseguir emprego",
    ],
  }),
  confirmation("B2", "reading", 2, {
    passage:
      "I booked the pasta-making class mostly to get my partner off the couch, so my expectations were modest. The chef, Luca, was patient and funny, and by the end even I had produced something resembling ravioli. The class runs nearly three hours, though, and the last forty minutes, spent waiting for everyone's dough to rest, dragged. At ninety dollars a person, it's not cheap. Still, we've made pasta at home twice since, which is two more times than I expected.",
    question: "O que o autor dá a entender sobre a aula?",
    right: [
      "Gostou mais do que esperava",
      "Achou que parte da aula foi lenta",
      "A aula mudou um pouco os hábitos do casal",
    ],
    wrong: ["Achou o preço baixo para o que oferece", "O chef foi impaciente com os alunos"],
  }),
  confirmation("B2", "listening", 1, {
    passage:
      "Supporters say the new regional airport will bring jobs, and it probably will, at least during construction. My concern is what happens after. The plan assumes three million passengers a year by 2035, but the airport we already have rarely fills half its gates. If those numbers don't arrive, the town is left paying for a very expensive empty building. I'd like to see a smaller first phase, and expand only if the demand turns out to be real.",
    question: "O que a convidada dá a entender?",
    right: [
      "Duvida das previsões de passageiros",
      "Prefere começar com uma obra menor",
      "Teme que a cidade pague por um prédio vazio",
    ],
    wrong: [
      "É totalmente contra o aeroporto novo",
      "Acha que a obra não vai gerar empregos",
      "Diz que o aeroporto atual vive lotado",
    ],
  }),
  confirmation("B2", "listening", 2, {
    passage:
      "Hi, we're back from the lake. So, the cabin looked nothing like the photos; the 'lake view' was mostly a parking lot. And it rained four days out of five. But honestly, the kids didn't care at all. They played cards, built a fort out of blankets and want to go back next year. So I guess it was a success, just not the one I paid for.",
    question: "O que a pessoa dá a entender sobre a viagem?",
    right: [
      "A cabana não correspondia às fotos",
      "As crianças se divertiram mesmo assim",
      "Ela tem sentimentos mistos sobre a viagem",
    ],
    wrong: ["Fez sol na maior parte da viagem", "As crianças não querem voltar ao lago"],
  }),
  confirmation("C1", "reading", 1, {
    passage:
      "The new production of 'Harbor Lights' arrives with an impressive cast and a set that practically rotates on command. Yet for all its polish, something has gone missing since the original run thirty years ago. That version was rough and occasionally under-rehearsed, but it felt urgent, as though the actors believed the play might change something. Here, every line lands exactly where it should, and almost none of it lands with any weight. Audiences who never saw the original will likely enjoy a handsome evening. Those who did may leave wondering why a play about desperation now feels so comfortable.",
    question: "O que a crítica dá a entender?",
    right: [
      "A nova montagem é bem feita, mas perdeu a urgência",
      "A versão original tinha falhas técnicas",
      "Quem não viu a original deve gostar mais",
    ],
    wrong: [
      "O elenco novo é fraco e mal ensaiado",
      "A crítica prefere a nova versão à original",
      "O cenário é simples e quase não muda",
    ],
  }),
  confirmation("C1", "reading", 2, {
    passage:
      "There is a particular kind of article, published every few years, that announces our generation has lost the art of conversation. I confess I find these pieces both irritating and hard to dismiss. Irritating, because they tend to romanticize a past in which most people had far fewer chances to speak at all. Hard to dismiss, because anyone who has watched a dinner table go silent as five phones light up knows the authors are not entirely inventing things. Perhaps the honest position is that we talk as much as ever, just less often to the people in front of us.",
    question: "Qual é a posição do autor?",
    right: [
      "Vê exagero nesses textos, mas reconhece parte de verdade",
      "Acha que esses artigos idealizam o passado",
      "Sugere que falamos menos com quem está perto",
    ],
    wrong: [
      "Concorda que perdemos de vez a arte de conversar",
      "Acha que hoje as pessoas falam bem menos que antes",
    ],
  }),
  confirmation("C1", "listening", 1, {
    passage:
      "I'll give the council this much: the new stadium is beautiful, and on game nights the neighborhood has never been livelier. But we were promised it would pay for itself within ten years, and we're now in year six with the debt barely touched. Local restaurants are doing well on forty nights a year; the other three hundred and twenty-five, the area is as quiet as it ever was. So, a success? As architecture, absolutely. As an investment, the jury is still out, and I'm not optimistic about the verdict.",
    question: "O que o comentarista dá a entender?",
    right: [
      "O estádio é bonito, mas o retorno financeiro decepciona",
      "O movimento no bairro depende dos dias de jogo",
      "Ele está pessimista sobre o investimento",
    ],
    wrong: [
      "A dívida do estádio já está quase paga",
      "Os restaurantes vão bem o ano inteiro",
      "Ele acha o estádio feio, mas lucrativo",
    ],
  }),
  confirmation("C1", "listening", 2, {
    passage:
      "People assume the hard part of success is the pressure, and sure, there's some. But for me it was stranger than that. After the second album, every song I wrote, I'd hear it through the ears of people I'd never meet, wondering if it was what they wanted. It took me years to get back to writing for an audience of one. These days I'm playing smaller rooms, and I know some people see that as a step down. I don't. It's the first time in a decade the music has felt like mine again.",
    question: "O que o músico dá a entender?",
    right: [
      "O sucesso o fez compor pensando nos outros",
      "Ele não vê os shows menores como um retrocesso",
      "Hoje a música voltou a parecer dele",
    ],
    wrong: ["A pressão foi a pior parte do sucesso", "Ele passou dez anos sem compor nada"],
  }),
  confirmation("C2", "reading", 1, {
    passage:
      "My grandmother kept two clocks in her kitchen in Hamilton, and neither of them told the right time. One ran eleven minutes fast, she said, so she would never be late for church; the other ran slow for reasons she declined to explain. As a child I assumed this was eccentricity. It was only after her funeral, sorting through letters she had written and never sent, that I understood the second clock had stopped being adjusted the spring my grandfather left. She had been living, for forty years, a little behind the rest of us, in a house where it was always slightly earlier than the moment he walked out the door.",
    question: "O que o texto sugere?",
    right: [
      "O relógio atrasado prendia a avó ao dia em que o avô partiu",
      "O narrador só entendeu o relógio depois da morte da avó",
      "A avó nunca superou de todo a partida do marido",
    ],
    wrong: [
      "A avó atrasava o relógio por pura excentricidade",
      "O avô morreu na primavera em que o relógio parou",
      "O relógio adiantado servia para lembrar do avô",
    ],
  }),
  confirmation("C2", "reading", 2, {
    passage:
      "There is a risk, with a debut as decorated as this one, that the prizes do the reading for us. So let me say plainly that the best poems here earn their praise: the sequence about the poet's father's hands is precise, unsentimental and devastating in its restraint. The trouble is that restraint becomes a habit. By the final section, poem after poem ends on the same quiet image, a window, a closing door, as if the poet had found a key and decided it opens every lock. Readers new to poetry could hardly find a better place to start. It is a remarkable first book. It would be a more remarkable one at two-thirds the length.",
    question: "O que a crítica dá a entender?",
    right: [
      "Os melhores poemas merecem os prêmios",
      "A contenção, boa no início, vira fórmula",
      "O livro seria melhor se fosse mais curto",
    ],
    wrong: [
      "Os prêmios foram exagerados para um livro fraco",
      "Os poemas finais são os mais variados do livro",
      "O poema sobre as mãos do pai é sentimental demais",
    ],
  }),
  confirmation("C2", "listening", 1, {
    passage:
      "Before we wrap up, I want to thank our panel, who managed to disagree for ninety minutes without once raising their voices, which in this city counts as a minor miracle. We didn't settle the question of whether the waterfront should be developed or protected, and I suspect we were never going to. What I think we did establish is that both sides want the same thing, a waterfront people actually use, and differ mostly on how much they trust the developers to deliver it. That's a narrower disagreement than the headlines suggest, and perhaps a more useful one.",
    question: "O que o mediador dá a entender?",
    right: [
      "A divergência é menor do que dizem as manchetes",
      "O debate não resolveu a questão principal",
      "A diferença está na confiança nas construtoras",
    ],
    wrong: [
      "Os participantes discutiram de forma agressiva",
      "Um dos lados quer a orla vazia e sem uso",
      "O debate decidiu que a orla será protegida",
    ],
  }),
  confirmation("C2", "listening", 2, {
    passage:
      "In my family, the story goes that my great-great-grandfather won his farm in a card game. My aunt tells it at every Sunday dinner, with great pride, as proof that we come from bold people. My father always tells it with a raised eyebrow, because, as he points out, nobody ever mentions who lost the farm, or what became of them. I used to think one of them must be telling it wrong. Now I suspect the story survives precisely because it lets each of us keep the ancestor we need.",
    question: "O que o narrador dá a entender?",
    right: [
      "Cada parente conta a história do seu jeito",
      "O pai desconfia do lado heroico da história",
      "A história dura porque serve a cada um",
    ],
    wrong: ["A tia acha a história vergonhosa", "O narrador descobriu quem perdeu a fazenda"],
  }),
];

/**
 * Three questions per skill at each level are enough for a whole-course test, which asks up to
 * sixteen per skill and moves to the nearest level when one runs out; each level's check takes
 * two confirmations per skill.
 */
export const englishLevelTest: SeedLevelTest = { confirmations, questions };
