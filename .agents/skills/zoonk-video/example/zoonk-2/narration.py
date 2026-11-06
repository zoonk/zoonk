# Narration for scripts/narration.py and scripts/mix.py.
MODEL = "google/gemini-3.8-flash-tts"
VOICE = "Charon"
LANGS = ["en", "pt"]

# Per cut: (id, start s, scene end s, en, pt). A line may run past its scene's end, never into the next line;
# the scene end bounds only the last line.
CUTS = {}
CUTS["long"] = [
 ("L01", 0.6, 5.6, "Everyone has something they want to learn.", "Todo mundo tem algo que quer aprender."),
 ("L02", 6.1, 9.5, "But where do you start? And will you be ready in time?", "Mas por onde começar? E vai dar tempo?"),
 ("L03", 10.0, 14.2, "Meet Zoonk two point oh. A daily plan for your goal.", "Conheça o Zoonk dois ponto zero."),
 ("L04", 14.7, 19.1, "Just tell it your goal, in your own words.", "É só contar o seu objetivo, do seu jeito."),
 ("L05", 19.4, 23.9, "A quick check finds what you already know, so your plan can skip it.", "Um teste rápido vê o que você já sabe, e o plano pula essa parte."),
 ("L06", 24.2, 29.8, "Then pick how much time you have each day, and see right away if it's enough to reach your goal.", "Depois, escolha quanto tempo você tem por dia e veja na hora se dá para chegar lá."),
 ("L07", 30.05, 34.6, "From then on, just open Zoonk each day. Your lessons are ready.", "A partir daí, é só abrir o Zoonk todo dia. Suas aulas já estão prontas."),
 ("L08", 35.0, 40.6, "Missed a day? No guilt. Your plan adjusts on its own.", "Perdeu um dia? Sem culpa. O plano se ajusta sozinho."),
 ("L09", 41.0, 43.1, "Whatever you're working toward.", "Seja qual for o seu objetivo."),
 ("L10", 43.4, 47.9, "Your exam plan follows the official guide, and what comes up most.", "Na prova, o plano segue o edital e foca no que mais cai."),
 ("L11", 48.2, 52.7, "Mock exams are timed like the real one.", "Os simulados têm o tempo da prova real."),
 ("L12", 52.9, 55.7, "Practice IELTS speaking with an AI examiner.", "Sua redação é corrigida nas cinco competências."),
 ("L13", 56.1, 58.7, "And every mistake comes with the reason why.", "E cada erro vem com o motivo."),
 ("L14", 59.0, 62.3, "Learning a language? It's built around real situations.", "Aprendendo um idioma? Tudo parte de situações reais."),
 ("L15", 62.65, 64.9, "Hear every word, and how to say it.", "Ouça cada palavra."),
 ("L16", 66.5, 70.6, "Then practice the real conversation, and see what to improve.", "Depois, treine a conversa de verdade e veja o que melhorar."),
 ("L17", 71.0, 74.3, "It even spots the mistakes you keep making.", "Ele até percebe os erros que você repete."),
 ("L18", 74.5, 79.1, "Changing careers? Learn the skills and tools the new job asks for.", "Mudando de carreira? Aprenda as habilidades e ferramentas que o novo trabalho pede."),
 ("L19", 79.25, 83.9, "Or just curious? Learn anything, at your own pace.", "Ou só por curiosidade? Aprenda qualquer coisa, no seu ritmo."),
 ("L20", 84.55, 86.3, "Lessons take about three minutes.", "Cada aula leva uns três minutos."),
 ("L21", 86.8, 95.5, "And you learn by doing. Explore a map, test a formula, run real code, even play music.", "E você aprende fazendo. Explore um mapa, teste uma fórmula, rode código de verdade e até toque música."),
 ("L22", 96.2, 100.6, "Got it wrong? You'll see why, and the question comes back later.", "Errou? Você entende o porquê, e a pergunta volta depois."),
 ("L23", 100.9, 103.1, "Stuck? Ask Zu.", "Travou? Pergunte para o Zu."),
 ("L24", 103.4, 107.9, "Your study buddy explains it in simpler words, or goes deeper.", "Seu parceiro de estudos explica de um jeito mais simples, ou mais a fundo."),
 ("L25", 108.2, 112.6, "And what you learn comes back for a quick review, right before you'd forget it.", "E o que você aprende volta numa revisão rápida, logo antes de você esquecer."),
 ("L26", 113.0, 117.2, "Every lesson moves you up through ten belts, like in martial arts.", "Cada aula te leva pelas dez faixas, como nas artes marciais."),
 ("L27", 117.4, 119.8, "And Zu grows up right along with you.", "E o Zu também cresce com você."),
 ("L28", 120.2, 124.6, "Taking a few days off? Nothing resets. You pick up where you left off.", "Precisa de uns dias de folga? Nada zera. Você continua de onde parou."),
 ("L29", 125.0, 131.8, "At the end of each phase, the Trickster is waiting. No hints. No mercy.", "No fim de cada fase, o Pegadinha te espera. Sem dicas. Sem piedade."),
 ("L30", 132.2, 136.6, "Whatever your goal, you get there one day at a time.", "Seja qual for o objetivo, você chega lá um dia de cada vez."),
 ("L31", 137.4, 146.4, "So, what's your goal? Start free at zoonk dot com.", "E aí, qual é o seu objetivo? Comece grátis em zoonk ponto com."),
]
CUTS["short"] = [
 ("S1", 0.5, 4.6, "Tell Zoonk your goal, in your own words.", "Conte o seu objetivo para o Zoonk, do seu jeito."),
 ("S2", 5.0, 9.4, "You get a plan for every day, all the way to your goal.", "Você ganha um plano para cada dia, até chegar no seu objetivo."),
 ("S3", 9.8, 14.2, "Then you learn by doing, in three-minute lessons.", "E aprende fazendo, em aulas de três minutos."),
 ("S4", 14.6, 17.8, "Got it wrong? You'll see why.", "Errou? Você entende o porquê."),
 ("S5", 18.2, 22.6, "Stuck? Zu, your study buddy, explains it another way.", "Travou? Pergunte para o Zu, seu parceiro de estudos."),
 ("S6", 23.0, 27.4, "And taking a break never resets your progress.", "E dar uma pausa nunca zera o seu progresso."),
 ("S7", 27.8, 32.2, "Exams, languages, a new career, or anything.", "Provas, idiomas, carreira, ou o que quiser."),
 ("S8", 32.6, 38.0, "What's your goal? Start free at zoonk dot com.", "Qual é o seu objetivo? Comece grátis em zoonk ponto com."),
]
INSTR = {
 "en": "Warm, calm and confident, like the narrator of an Apple product film. Natural American English, unhurried, friendly, never salesy. The brand name Zoonk is said zoonk, exactly like the word zoo followed by nk (IPA zuːŋk), never zoom or zoot. Zu is said like zoo.",
 "pt": "Fale em português do Brasil, com sotaque brasileiro natural. Voz calorosa, calma e confiante, como a narração de um filme de produto da Apple. Sem pressa, simpática, nunca vendedora. A marca Zoonk se pronuncia zunk, com u longo como em zoológico, terminando seco no k, sem vogal no final (IPA zuŋk), nunca zonque ou zunqui. Leia perguntas com entonação de pergunta. O nome Zu se pronuncia zú, com u oral e claro, sem nasalizar.",
}

# Extra direction for one line, appended to INSTR in its language.
TONE = {
 "L29": {
  "en": "Read this line like a movie trailer introducing a video game's final boss: lower, slower and ominous, with a dramatic pause before 'the Trickster' and a playful wink on 'No mercy.'",
  "pt": "Leia esta frase como o trailer de um filme apresentando o chefão final de um videogame: voz mais grave e sombria, com uma pausa curta antes de 'o Pegadinha' e uma piscadela divertida em 'Sem piedade.' Sem arrastar: as pausas são curtas.",
 },
}

# Captions show these as written.
SPOKEN = {
 "Zoonk two point oh": "Zoonk 2.0",
 "Zoonk dois ponto zero": "Zoonk 2.0",
 "zoonk dot com": "zoonk.com",
 "zoonk ponto com": "zoonk.com",
}

# Spoken sample words, cued in the page as Z.sfx("<id>", t).
WORDS = [
 {
  "id": "word-quedarse",
  "voice": "Kore",
  "text": "quedarse",
  "instructions": "Say this single Spanish word clearly and naturally, Mexican Spanish, like the audio of a language-learning app."
 },
 {
  "id": "word-stay",
  "voice": "Kore",
  "text": "stay",
  "instructions": "Say this single English word clearly and naturally, British English, like the audio of a language-learning app."
 }
]
