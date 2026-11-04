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
 ("L06", 24.2, 29.8, "Then it shows you, honestly, what your daily time can cover.", "Depois, mostra com honestidade quanto o seu tempo por dia cobre até a sua data."),
 ("L07", 30.2, 34.6, "After that, your day starts on the Today screen. Just follow it.", "E cada dia começa na tela Hoje. É só seguir."),
 ("L08", 35.0, 40.6, "Missed a day? No guilt. What's left comes first, and your plan adjusts.", "Perdeu um dia? Sem culpa. O que faltou vem primeiro, e o plano se ajusta."),
 ("L09", 41.0, 43.1, "Whatever you're working toward.", "Seja qual for o seu objetivo."),
 ("L10", 43.4, 47.9, "Your exam plan follows the official guide, and what comes up most.", "Na prova, o plano segue o edital e foca no que mais cai."),
 ("L11", 48.2, 52.7, "Mock exams are timed like the real one.", "Os simulados têm o tempo da prova real."),
 ("L12", 52.9, 55.7, "Practice IELTS speaking with an AI examiner.", "Sua redação é corrigida nas cinco competências."),
 ("L13", 56.0, 58.7, "And every mistake comes with the reason why.", "E cada erro vem com o motivo."),
 ("L14", 59.0, 62.3, "Learning a language? It's built around real situations.", "Aprendendo um idioma? Tudo parte de situações reais."),
 ("L15", 62.6, 64.9, "Hear every word, and how to say it.", "Ouça cada palavra."),
 ("L16", 66.5, 70.6, "Then practice the real conversation, and see what to improve.", "Depois, treine a conversa de verdade e veja o que melhorar."),
 ("L17", 71.0, 74.3, "It even spots the mistakes you keep making.", "Ele até percebe os erros que você repete."),
 ("L18", 74.6, 79.1, "Changing careers? Your portfolio always stays in.", "Mudando de carreira? O portfólio fica sempre no plano."),
 ("L19", 79.25, 83.9, "Learn anything, at your own pace.", "Ou aprenda qualquer coisa, no seu ritmo."),
 ("L20", 84.55, 86.3, "Lessons take about three minutes.", "Cada aula leva uns três minutos."),
 ("L21", 86.8, 95.5, "And you learn by doing. Explore a map, test a formula, run real code, even play music.", "E você aprende fazendo. Explore um mapa, teste uma fórmula, rode código de verdade e até toque música."),
 ("L22", 96.2, 100.6, "Got it wrong? You'll see why, and the question comes back later.", "Errou? Você entende o porquê, e a pergunta volta depois."),
 ("L23", 100.9, 103.1, "Stuck? Ask Zu.", "Travou? Pergunte para o Zu."),
 ("L24", 103.4, 107.9, "Zu explains any screen in simpler words, or goes deeper.", "O Zu explica de um jeito mais simples, ou mais a fundo."),
 ("L25", 108.2, 110.4, "And reviews bring it back before you forget.", "E tudo volta antes de você esquecer."),
 ("L26", 110.9, 115.1, "Change your plan just by asking.", "Mude o plano só pedindo."),
 ("L27", 115.4, 119.9, "There's no streak to lose. Energy just dips a little on days off.", "Sem ofensiva para perder. A Energia só cai um pouco nos dias de folga."),
 ("L28", 120.2, 124.7, "Brain Power only goes up, and Zu grows with you.", "O Poder Mental só aumenta, e o Zu cresce com você."),
 ("L29", 125.0, 129.5, "And at the end of each phase, take on the Trickster.", "E no fim de cada fase, enfrente o Pegadinha."),
 ("L30", 129.8, 134.2, "Whatever your goal, you get there one day at a time.", "Seja qual for o objetivo, você chega lá um dia de cada vez."),
 ("L31", 134.6, 137.9, "In your browser, in ten languages.", "No navegador, em dez idiomas."),
 ("L32", 138.6, 144.0, "So, what's your goal? Start free at zoonk dot com.", "E aí, qual é o seu objetivo? Comece grátis em zoonk ponto com."),
]
CUTS["short"] = [
 ("S1", 0.5, 4.6, "Tell Zoonk your goal, in your own words.", "Conte o seu objetivo para o Zoonk, do seu jeito."),
 ("S2", 5.0, 9.4, "You get a plan for every day until your date.", "Você ganha um plano para cada dia até a sua data."),
 ("S3", 9.8, 14.2, "Then you learn by doing, in three-minute lessons.", "E aprende fazendo, em aulas de três minutos."),
 ("S4", 14.6, 17.8, "Got it wrong? You'll see why.", "Errou? Você entende o porquê."),
 ("S5", 18.2, 22.6, "Stuck? Zu, your study buddy, explains it another way.", "Travou? Pergunte para o Zu, seu parceiro de estudos."),
 ("S6", 23.0, 27.4, "And there's no streak to lose.", "E não tem ofensiva para perder."),
 ("S7", 27.8, 32.2, "Exams, languages, a new career, or anything.", "Provas, idiomas, carreira, ou o que quiser."),
 ("S8", 32.6, 38.0, "What's your goal? Start free at zoonk dot com.", "Qual é o seu objetivo? Comece grátis em zoonk ponto com."),
]
INSTR = {
 "en": "Warm, calm and confident, like the narrator of an Apple product film. Natural American English, unhurried, friendly, never salesy. The brand name Zoonk is said zoonk, exactly like the word zoo followed by nk (IPA zuːŋk), never zoom or zoot. Zu is said like zoo.",
 "pt": "Fale em português do Brasil, com sotaque brasileiro natural. Voz calorosa, calma e confiante, como a narração de um filme de produto da Apple. Sem pressa, simpática, nunca vendedora. A marca Zoonk se pronuncia zunk, com u longo como em zoológico, terminando seco no k, sem vogal no final (IPA zuŋk), nunca zonque ou zunqui. Leia perguntas com entonação de pergunta. O nome Zu se pronuncia zú, com u oral e claro, sem nasalizar.",
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
