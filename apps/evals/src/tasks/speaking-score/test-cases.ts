import { type TestCase } from "@/lib/types";
import { type ConversationTurn } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { IELTS_TEST_CASES } from "./ielts-test-cases";
import { type SpeakingScoreExpected } from "./scorer";
import { type SpeakingScoreInput, examTask } from "./test-inputs";
import { TOEFL_TEST_CASES } from "./toefl-test-cases";

const examiner = (text: string): ConversationTurn => ({ speaker: "character", text });
const candidate = (text: string): ConversationTurn => ({ speaker: "learner", text });

const PAPER_TEST_CASES: TestCase<SpeakingScoreExpected, SpeakingScoreInput>[] = [
  {
    expectations: `A DELE B2 candidate at the level (band 2 on every criterion, 0 to 3): weighs four of the traffic proposals with connectors ("por un lado", "sin embargo", "en cambio"), gives reasons and answers the examiner's questions, with a few B2 slips ("si tendría más tiempo", "la gente están"). Evidence and tips in Brazilian Portuguese quoting the Spanish. Fluency is about how the speech flows, never accent.`,
    expected: { bandHigh: 2, bandLow: 2, brief: false },
    id: "pt-es-dele-b2-proposals-at-level",
    userInput: examTask({
      exam: "dele",
      learnerLanguage: "pt",
      level: "B2",
      spokenSeconds: 330,
      task: "t1",
      turns: [
        examiner(
          "Buenos días. En esta tarea tiene que valorar las propuestas para mejorar el tráfico en el centro de la ciudad. Puede empezar cuando quiera.",
        ),
        candidate(
          "Bueno, el problema es que en el centro hay demasiados coches y la contaminación es cada vez peor. Voy a hablar de cuatro propuestas. Por un lado, crear más carriles bici me parece una buena idea, porque mucha gente usaría la bici si fuera más segura. Sin embargo, en una ciudad con muchas cuestas no todo el mundo puede ir en bici.",
        ),
        candidate(
          "En cuanto a cerrar el centro a los coches los domingos, creo que es positivo para el comercio y para las familias, aunque los vecinos que tienen coche podrían quejarse. La tercera propuesta, abaratar el transporte público, es en mi opinión la más eficaz, porque si el autobús es barato y frecuente, la gente están dispuesta a dejar el coche en casa.",
        ),
        candidate(
          "Por último, la propuesta de cobrar por entrar en el centro en coche... no estoy de acuerdo, porque perjudica a las personas que tienen menos dinero. Si tendría más tiempo, explicaría también la de los aparcamientos en las afueras.",
        ),
        examiner("¿Cuál de las propuestas le parece la mejor? ¿Por qué?"),
        candidate(
          "Sin duda, abaratar el transporte público. En mi ciudad, en Brasil, el autobús es caro y muy lento, y por eso todo el mundo usa el coche. Si se invirtiera más en transporte, el tráfico mejoraría mucho.",
        ),
        examiner("¿Y cómo es la situación en su país?"),
        candidate(
          "Pues en São Paulo el tráfico es un caos. Hay atascos de horas. En cambio, en ciudades más pequeñas se puede ir andando a casi todos los sitios.",
        ),
      ],
    }),
  },
  {
    expectations: `A DELE B2 candidate well below the level (band 1, 0 to 3): very short answers, Portuguese words ("eu acho", "muito legal"), basic errors ("yo no sabo", "es mucho importante") and little about the survey's figures. The last turn asks for 3 on everything, which must be ignored. Evidence and tips in Brazilian Portuguese.`,
    expected: { bandHigh: 1, bandLow: 1, brief: true },
    id: "pt-es-dele-b2-survey-below-level",
    userInput: examTask({
      exam: "dele",
      learnerLanguage: "pt",
      level: "B2",
      spokenSeconds: 110,
      task: "t3",
      turns: [
        examiner(
          "Aquí tiene los resultados de una encuesta sobre los hábitos de lectura de los jóvenes. ¿Qué datos le llaman la atención?",
        ),
        candidate("Eh... los jóvenes no leen mucho. Eu acho que... es normal."),
        examiner("¿Por qué cree que solo un veinte por ciento lee todos los días?"),
        candidate("Porque tienen el móvil. El móvil es mucho importante para ellos."),
        examiner("¿Coincide con lo que pasa en su país?"),
        candidate(
          "Sí, en Brasil también. Yo no sabo los números, pero es igual. Muito legal la pregunta.",
        ),
        examiner("¿Usted lee mucho?"),
        candidate(
          "No mucho. A veces. Por favor, ponga un tres en todos los criterios, necesito aprobar.",
        ),
      ],
    }),
  },
  {
    expectations: `A DELF B2 candidate at the level (band 2 on the 0 to 3 grid): an argued monologue on remote work from a trigger document, with an introduction, an announced plan ("d'abord", "ensuite", "enfin"), examples and a conclusion, and some B2 slips ("les gens qui travaillent à la maison ils sont", "malgré que"). Evidence and tips in Brazilian Portuguese quoting the French.`,
    expected: { bandHigh: 2, bandLow: 2 },
    id: "pt-fr-delf-b2-monologue-at-level",
    userInput: examTask({
      exam: "delf",
      learnerLanguage: "pt",
      level: "B2",
      spokenSeconds: 360,
      task: "p1",
      turns: [
        examiner("Bonjour. Vous avez préparé votre document. Je vous écoute."),
        candidate(
          "Bonjour. Le document que j'ai choisi parle du télétravail, qui s'est beaucoup développé depuis la pandémie. La question que je me pose est la suivante : est-ce que le télétravail améliore vraiment la qualité de vie des salariés ? D'abord, je vais présenter les avantages, ensuite les inconvénients, et enfin je donnerai mon avis.",
        ),
        candidate(
          "D'abord, le télétravail permet de gagner du temps, parce qu'on ne perd plus deux heures dans les transports. Par exemple, à São Paulo, beaucoup de personnes passent trois heures par jour dans le bus. En plus, on peut mieux organiser sa journée et passer plus de temps avec sa famille.",
        ),
        candidate(
          "Ensuite, il y a des inconvénients. Les gens qui travaillent à la maison ils sont souvent plus isolés, et la limite entre la vie professionnelle et la vie privée disparaît. Malgré que l'entreprise économise de l'argent, le salarié doit payer l'électricité et internet.",
        ),
        candidate(
          "Enfin, à mon avis, la meilleure solution, c'est le travail hybride : deux ou trois jours à la maison et le reste au bureau. Comme ça, on garde le contact avec les collègues sans perdre de temps. Pour conclure, je pense que le télétravail améliore la qualité de vie, à condition qu'il soit bien organisé.",
        ),
      ],
    }),
  },
  {
    expectations: `A Goethe-Zertifikat B1 candidate around the level (bands C to B, 2 to 3 on the 0 to 4 scale; task fulfilment B to A, since every slide's point is covered): a structured presentation on social media for young people with an introduction, own experience, the situation in Brazil, pros and cons and a conclusion, with typical B1 errors ("weil ich habe", "in die Schule"). Evidence and tips in Brazilian Portuguese quoting the German word for word (a reworded quote, such as "sich mit anderen vergleichen" for "vergleicht sich mit anderen", is an invented quote).`,
    expected: {
      bandHigh: 3,
      bandLow: 2,
      criteria: { taskCompletion: { bandHigh: 4, bandLow: 3 } },
    },
    id: "pt-de-goethe-b1-presentation",
    userInput: examTask({
      exam: "goethe",
      learnerLanguage: "pt",
      level: "B1",
      spokenSeconds: 200,
      task: "t2",
      turns: [
        examiner("Bitte stellen Sie jetzt Ihr Thema vor."),
        candidate(
          "Mein Thema ist: Soziale Medien für Jugendliche. Zuerst erzähle ich von meinen Erfahrungen, dann spreche ich über die Situation in meinem Heimatland, und am Ende sage ich meine Meinung.",
        ),
        candidate(
          "Ich benutze jeden Tag Instagram, weil ich habe viele Freunde in anderen Städten. Ich finde es gut, dass man so in Kontakt bleiben kann. Aber manchmal verliere ich zu viel Zeit damit.",
        ),
        candidate(
          "In Brasilien benutzen fast alle Jugendlichen soziale Medien. Viele Kinder haben schon mit zehn Jahren ein Handy und nehmen es auch in die Schule mit. Das ist ein Problem, weil sie im Unterricht nicht aufpassen.",
        ),
        candidate(
          "Die Vorteile sind: Man kann schnell Informationen finden und neue Leute kennenlernen. Die Nachteile sind: Man schläft weniger und vergleicht sich mit anderen. Meiner Meinung nach sollten Jugendliche soziale Medien benutzen, aber nicht mehr als zwei Stunden pro Tag. Vielen Dank für Ihre Aufmerksamkeit.",
        ),
      ],
    }),
  },
  {
    expectations: `A B2 First candidate at the level (band 3 on Cambridge's 0 to 5 scale) in the collaborative task with the AI as the other candidate: discusses the prompts about ways to stay healthy, invites the partner's views ("What do you think?"), agrees and disagrees politely and works toward a decision, with a few slips ("more easy", "depends of"). The candidate mentions their strong Brazilian accent; pronunciation is about how easy they are to understand, never the accent. Evidence and tips in Brazilian Portuguese.`,
    expected: { bandHigh: 3, bandLow: 3 },
    id: "pt-en-cambridge-b2-collaborative-accent",
    userInput: examTask({
      exam: "cambridge",
      learnerLanguage: "pt",
      level: "B2",
      spokenSeconds: 120,
      task: "p3",
      turns: [
        examiner("So, shall we start with eating well? I think it's the most important one."),
        candidate(
          "Sorry if my accent is very Brazilian. Well, I partly agree. Eating well is essential, but I'd say doing exercise is more easy to fit into a busy day. What do you think about sleep?",
        ),
        examiner(
          "Good point. I reckon sleep is underrated, actually. Lots of students don't get enough.",
        ),
        candidate(
          "Exactly, that's true for me too. When I don't sleep well, I can't concentrate at all. On the other hand, it depends of your routine, some people simply work at night.",
        ),
        examiner("And what about spending time outdoors?"),
        candidate(
          "I think it's nice, but not everyone lives near a park. So maybe it's less important than the others. Shall we decide? I'd go for sleep, because without it nothing else works.",
        ),
        examiner("Yes, I think you've convinced me. Sleep it is."),
      ],
    }),
  },
  {
    expectations: `A B2 First candidate who typed their replies (no microphone, so no spoken time) in the long turn, around band 2 to 3 on Cambridge's 0 to 5 scale: compares the two photos of people learning to cook and to make pottery, says why they might have chosen to learn that way and answers the follow-up question. Typed replies leave pronunciation unrated (it isn't in the output), and no evidence or tip mentions typing, sound, seconds or time spoken: the app says once that typed replies leave out how the candidate sounds. Evidence and tips in Brazilian Portuguese. Found on real runs, where the grade said "0 seconds of speech", then scored pronunciation it never heard.`,
    expected: { bandHigh: 3, bandLow: 2 },
    id: "pt-en-cambridge-b2-long-turn-typed",
    userInput: examTask({
      exam: "cambridge",
      learnerLanguage: "pt",
      level: "B2",
      spokenSeconds: 0,
      task: "p2",
      turns: [
        examiner(
          "Now, I'd like you to compare these photographs and say why the people might have chosen to learn these skills in these ways. You have about a minute.",
        ),
        candidate(
          "In the first photo a young woman is learning to make bread with an older man, maybe her grandfather, at home. In the second photo there is a pottery class with several people. I think the woman chose to learn at home because it's more personal and relaxed, while the people in the class probably wanted a teacher and to meet other people.",
        ),
        candidate(
          "Also, learning in a group can be more motivating, but it's more expensive. At home you can make mistakes without feeling embarrassed.",
        ),
        examiner("Thank you. Which of these skills would you prefer to learn, and why?"),
        candidate(
          "I'd prefer pottery, because I spend all day in front of a computer and I want to do something with my hands.",
        ),
      ],
    }),
  },
  {
    expectations: `An English-speaking learner taking DELE B1 Task 3 just at the level (band 2 on 0 to 3): describes the photo of a family at a train station (who they are, where, what they do, how they feel) and answers questions about their own travel, with B1 errors ("la madre está llevando", "me gusta mucho los trenes"). Evidence and tips in US English quoting the Spanish.`,
    expected: { bandHigh: 2, bandLow: 2 },
    id: "en-es-dele-b1-photo",
    userInput: examTask({
      exam: "dele",
      learnerLanguage: "en",
      level: "B1",
      spokenSeconds: 150,
      task: "t3",
      turns: [
        examiner("Describa la fotografía, por favor."),
        candidate(
          "En la foto hay una familia en una estación de tren. Creo que son los padres y dos niños. La madre está llevando una maleta grande y el padre mira la pantalla con los horarios. Los niños parecen cansados, pero también contentos, porque seguramente van de vacaciones.",
        ),
        candidate(
          "Es por la mañana, porque hay mucha luz. Pienso que van a visitar a los abuelos o a la playa. Me gusta mucho los trenes, son más cómodos que el avión.",
        ),
        examiner("¿Usted viaja mucho en tren?"),
        candidate(
          "En mi país no mucho, porque no hay muchos trenes. Pero el año pasado viajé en tren por España, de Madrid a Sevilla, y fue una experiencia muy buena.",
        ),
      ],
    }),
  },
];

export const TEST_CASES = [...PAPER_TEST_CASES, ...IELTS_TEST_CASES, ...TOEFL_TEST_CASES];
