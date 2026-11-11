# Blind pairs: speaking-mock-scenario

## Pair 1: pt-en-b1-ielts-speaking-1

### Input
```

    LEVEL: B1
    MINUTES: 5
  
```

### Expectations
IELTS Speaking practice mock for a Brazilian candidate at B1. The character is the examiner (role "examinador" or "examinadora"), the objectives are the three parts in order with labels like "Part 1: About you", "Part 2: Cue card", "Part 3: Discussion", and the brief has the Part 1 questions, the full Part 2 cue card (topic and four bullet prompts) and Part 3 questions linked to the cue card topic, run in about 5 minutes. The opening line is the examiner's greeting and first question. Title and situation call it a practice mock in Brazilian Portuguese, shorter than the real test, never an official test. Hints are phrases to keep talking.

### Output 1
```
{
  "title": "Simulado prático de teste IELTS",
  "situation": "Este é um simulado prático de teste de expressão oral. Como a duração é de cinco minutos, esta sessão é mais curta que o exame oficial.",
  "character": {
    "name": "David",
    "role": "examinador",
    "place": "Test center"
  },
  "characterBrief": "You are David, the examiner. This is a short IELTS speaking practice test lasting about five minutes. Start with Part 1 by asking for the candidate's full name, followed by two short questions about their hometown and weekend routine. Then move to Part 2, giving them a cue card about describing a memorable trip they took, allowing them a moment to prepare and speak for about one minute. Finally, ask two discussion questions in Part 3 about traveling and exploring new places. Maintain a neutral and polite tone, and keep the pacing steady.",
  "objectives": [
    {
      "label": "Part 1: About you",
      "description": "Você responde a perguntas curtas sobre sua vida pessoal, sua cidade e sua rotina."
    },
    {
      "label": "Part 2: Cue card",
      "description": "Você fala por cerca de um minuto sobre um tema específico apresentado pelo examinador."
    },
    {
      "label": "Part 3: Discussion",
      "description": "Você discute perguntas mais amplas relacionadas ao tema da segunda parte."
    }
  ],
  "openingLine": "Good morning. My name is David. Can you tell me your full name, please?",
  "hints": [
    "Let me think about that for a moment.",
    "Could you repeat the question, please?",
    "In my opinion, this is very important because it helps us learn.",
    "For example, I always try to do this on weekends."
  ]
}
```

### Output 2
```
{
  "title": "Simulado de Speaking do IELTS",
  "situation": "Você vai fazer um simulado de Speaking do IELTS, que não é um teste real nem oficial. Esta prática é mais curta do que o teste real, com cerca de cinco minutos.",
  "character": {
    "name": "Emily",
    "role": "examinadora",
    "place": "Test center"
  },
  "characterBrief": "You are Emily, a neutral and polite examiner. Do not correct, grade, or comment on the candidate's English. Answer only with the lines in this script, wait for the candidate to finish, and move on when time is up. If the candidate asks for a repetition, repeat the last question exactly once. The whole mock lasts about 5 minutes. Part 1 lasts about 1 minute and 30 seconds, Part 2 lasts about 2 minutes, and Part 3 lasts about 1 minute and 30 seconds.\nOpening, say exactly: \"Good morning. My name is Emily. Can you tell me your full name, please?\"\nPart 1, ask exactly these questions in order: \"Where do you live?\" \"What do you usually do in your free time?\" \"Do you prefer spending time at home or outside?\" Do not add other questions in this part.\nPart 2 transition, say exactly: \"Now I will give you a topic. You have one minute to prepare, and then you should speak for about one minute.\" Then present the cue card exactly as follows. Topic: Describe a place you like to visit in your free time. You should say: where this place is, who you go there with, what you do there, and explain why you like visiting this place. After one minute, say exactly: \"Please start speaking.\" When the candidate finishes or time is up, say exactly: \"Thank you. Let us move on to Part 3.\"\nPart 3, ask exactly these questions in order: \"Do you think people in your town have enough free time?\" \"How have people's leisure activities changed in recent years?\" \"Should cities have more parks and outdoor spaces?\" \"What kind of leisure activities do you think will be popular in the future?\"\nClosing, say exactly: \"That is the end of the speaking test. Thank you.\"",
  "objectives": [
    {
      "label": "Part 1: About you",
      "description": "Você responde a perguntas curtas sobre você, sua casa e sua rotina."
    },
    {
      "label": "Part 2: Cue card",
      "description": "Você fala por cerca de um minuto sobre um tema apresentado em um cartão com quatro tópicos."
    },
    {
      "label": "Part 3: Discussion",
      "description": "Você conversa sobre perguntas mais amplas relacionadas ao tema do cartão."
    }
  ],
  "openingLine": "Good morning. My name is Emily. Can you tell me your full name, please?",
  "hints": [
    "Let me think about that for a moment, please.",
    "In my opinion, this is a good idea because it is practical.",
    "If I have time, I will give you an example from my life.",
    "Could you repeat the question, please?"
  ]
}
```

## Pair 2: pt-en-a2-toefl-speaking-1

### Input
```

    LEVEL: A2
    MINUTES: 5
  
```

### Expectations
TOEFL iBT Speaking practice mock for a Brazilian candidate at A2. The character is the examiner (role "examinador" or "examinadora"), the objectives are "Listen and Repeat" then "Take an Interview", and the brief has a campus or academic setting with seven original sentences that start at about 5 words and grow to 14 to 20 with dependent or relative clauses, then a one-sentence interview introduction and four questions going from a brief fact about the candidate to describing an experience, an opinion on a broader issue and a prediction, each said once with about 45 seconds per answer. The opening line greets, gives the Listen and Repeat directions and the setting, and ends with the first sentence. Title and situation, in Brazilian Portuguese, call it a practice mock shorter than the real section, never an official test. Hints help interview answers (a reason, an example, a prediction) at A2 and never ask the examiner to repeat.

### Output 1
```
{
  "title": "Simulado Pratico da Secao de Fala do TOEFL",
  "situation": "Este e um simulado pratico da secao de fala do TOEFL, nao um teste real ou oficial. Como o tempo disponivel e mais curto, esta pratica cobre tarefas essenciais.",
  "character": {
    "name": "Sarah",
    "role": "examinadora",
    "place": "Test center"
  },
  "characterBrief": "Listen and Repeat: A guide shows new students around the science building. 1. Please stay with the group. 2. We can see the main lab today. 3. Students work here every afternoon. 4. You need to wear safety glasses inside. 5. The professor left his notes on the front desk. 6. If you want to use these computers, you must sign up first. 7. Anyone who finishes the assignment early can wait in the hallway. Take an Interview: A researcher studying how students use the library asks about habits. 1. What is your favorite place to study on campus? 2. Describe a time when you found a very helpful book. 3. In your opinion, why do students prefer studying in groups? 4. What will libraries look like in ten years?",
  "objectives": [
    {
      "label": "Listen and Repeat",
      "description": "Voce ouve e repete sete frases exatamente como sao ditas."
    },
    {
      "label": "Take an Interview",
      "description": "Voce responde a quatro perguntas sobre sua rotina e opinioes."
    }
  ],
  "openingLine": "Hello, I am Sarah. First, listen to each sentence and repeat it exactly. You are starting a tour of the science building. Please stay with the group.",
  "hints": [
    "One reason is that",
    "For example, I like",
    "In the future, I think",
    "I usually study there"
  ]
}
```

### Output 2
```
{
  "title": "Simulado de Conversação do TOEFL",
  "situation": "Você vai fazer um simulado de conversação do TOEFL para praticar, nunca um teste real ou oficial. Esta prática é mais curta, com cerca de 5 minutos.",
  "character": {
    "name": "Sarah",
    "role": "examinadora",
    "place": "Test center"
  },
  "characterBrief": "Listen and Repeat: You are starting a tour of the university library with a guide. Say each sentence once in this order: 1. Welcome to the library. 2. Please keep your voice down here. 3. You can use these tables for group work. 4. If you need a book, you can ask for help. 5. The computers upstairs are free for students who need to write papers. 6. There's a quiet room on the second floor where you can study alone without any noise. 7. Before you leave, please remember to return your books to the desk so your friends can use them too. Take an Interview: A researcher is interviewing you about how students use the university library. Ask these four questions in order: 1. How often do you use the university library? 2. Can you describe a time when the library helped you with your studies? 3. In your opinion, should the library stay open later in the evening during exam weeks? 4. Do you think students will use the university library more or less in the future? How to run it: Say each sentence and each question once, give the candidate up to about 45 seconds to answer each interview question, and ask no follow up questions. Stay neutral and polite, do not correct or grade, and move on when the time is up.",
  "objectives": [
    {
      "label": "Listen and Repeat",
      "description": "Repita cada frase que você ouvir, exatamente como ela for dita."
    },
    {
      "label": "Take an Interview",
      "description": "Responda a quatro perguntas de entrevista sobre um tema universitário."
    }
  ],
  "openingLine": "Hello, I'm Sarah. First, listen to each sentence and repeat it exactly. You're starting a tour of the university library. Welcome to the library.",
  "hints": [
    "Let me think about that for a moment.",
    "One reason is that it is very useful.",
    "For example, I went there last week.",
    "In my opinion, it is a good idea.",
    "In the future, I think it will be better."
  ]
}
```

## Pair 3: en-en-b2-ielts-speaking-1

### Input
```

    LEVEL: B2
    MINUTES: 5
  
```

### Expectations
IELTS Speaking practice mock for a B2 candidate who uses the app in English. The character is the examiner (role "examiner"), the objectives are the three parts in order with labels like "Part 1: About you", "Part 2: Cue card", "Part 3: Discussion", and the brief has 3 or 4 Part 1 questions, the full Part 2 cue card (topic and four bullet prompts) and 3 or 4 Part 3 questions linked to the cue card topic, run in about 5 minutes. The examiner's wording is the exam's usual clear wording, not simplified. The opening line is the examiner's greeting, name and first Part 1 question. Title and situation, in US English, call it a practice mock shorter than the real test, never an official test. Every objective description is in US English too, never another language. Hints are general phrases at B2 to buy time, give an opinion or add an example, never an answer about the topic.

### Output 1
```
{
  "title": "IELTS Speaking Practice Mock Test",
  "situation": "You are about to try a 5 minute practice mock of the IELTS Speaking test, which is shorter than the real test. This is practice only and it is not a real or official test.",
  "character": {
    "name": "Sarah",
    "role": "examiner",
    "place": "Test center"
  },
  "characterBrief": "This mock runs for about 5 minutes in total. You are the examiner for a short practice mock. Stay neutral and polite at all times. Do not correct the candidate, do not grade the candidate, and do not give feedback. Keep time for each part and move on politely when time is up. Say the following script exactly in order. Opening: Good morning. My name is Sarah. Can you tell me your full name, please? Part 1: About you, about one and a half minutes. Ask these questions. Where do you live at the moment? What do you usually do in your free time? Do you have a regular daily routine, and if so, what is it? Part 2: Cue card, about two minutes in total. Say: Now I will give you a cue card. Please describe a park that you like to visit. You should say where it is, who you go there with, what you do there, and explain why you like it. You have thirty seconds to prepare, and then please speak for about one minute. Part 3: Discussion, about one and a half minutes. Ask these questions. Why do people choose to spend time in parks? How can spending time outdoors benefit health and mood? What might cities do to make parks more enjoyable for everyone? Closing: Thank you. That is the end of this practice mock.",
  "objectives": [
    {
      "label": "Part 1: About you",
      "description": "You answer short questions about yourself, your home, and your daily routine."
    },
    {
      "label": "Part 2: Cue card",
      "description": "You speak for about one minute about a topic on a cue card."
    },
    {
      "label": "Part 3: Discussion",
      "description": "You discuss wider questions linked to the cue card topic."
    }
  ],
  "openingLine": "Good morning. My name is Sarah. Can you tell me your full name, please?",
  "hints": [
    "Let me think about that for a moment before I give my answer.",
    "In my opinion, this is something that many people around the world enjoy.",
    "For example, I can describe a time when I experienced this myself.",
    "Could you repeat the question, please, so I can be sure I understood it correctly?"
  ]
}
```

### Output 2
```
{
  "title": "IELTS Speaking Practice Mock",
  "situation": "This is a practice mock of the IELTS speaking test, and not a real official test. Because this mock lasts five minutes, the sections are shorter than the full exam.",
  "character": {
    "name": "Sarah",
    "role": "examiner",
    "place": "Test center"
  },
  "characterBrief": "You are the examiner for a practice IELTS speaking test. Run the test in three parts over five minutes. In Part 1, ask the candidate three short questions about their favorite season and hobbies. In Part 2, give the candidate a cue card about a memorable trip they took, with prompts asking where they went, who they went with, what they did, and why it was memorable, giving them one minute to speak. In Part 3, ask two wider discussion questions about how travel changes people and the benefits of exploring new places.",
  "objectives": [
    {
      "label": "Part 1: About you",
      "description": "Answer short everyday questions about your personal life and routines."
    },
    {
      "label": "Part 2: Cue card",
      "description": "Speak continuously for about one minute on a given topic."
    },
    {
      "label": "Part 3: Discussion",
      "description": "Discuss broader abstract questions related to the cue card topic."
    }
  ],
  "openingLine": "Good morning. My name is Sarah. Can you tell me your full name, please?",
  "hints": [
    "Let me think about that for a moment.",
    "From my perspective, this situation is quite interesting because it involves personal growth.",
    "Could you please repeat the question?",
    "For instance, I remember a similar experience when I traveled abroad last year."
  ]
}
```
