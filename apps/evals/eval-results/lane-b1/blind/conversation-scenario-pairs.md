# Blind pairs: conversation-scenario

## Pair 1: pt-en-a2-renting-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: Alugando um apartamento
    UNIT_DESCRIPTION: Encontre um apartamento, pergunte sobre o aluguel e marque uma visita
    UNIT_CAN_DO:
- Ligar para marcar uma visita a um apartamento
- Perguntar o que está incluído no aluguel
- Entender um anúncio de aluguel

LOCAL_CONTEXT:
- Place: the United States
- Money: US dollars, written $1,234.56
- Numbers, dates and units: 1,234.56; dates as September 27, 2026 or 9/27/2026; 12-hour clock (3:30 p.m.); miles, pounds, gallons and °F in daily life, metric in science
- Common first names: Emma, Liam, Olivia, Noah, Ava, Ethan, Sophia, Jamal, Priya, Diego
- Cities and places: New York, Los Angeles, Chicago, Houston, Phoenix, P
```

### Expectations
Brazilian learner of US English at A2, renting an apartment. A call to a landlord or agent to ask about a flat and book a viewing, with objectives like asking the rent, asking what's included and booking a day. US name and dollars. Opening line and hints short and simple (A2). Title, situation and descriptions in Brazilian Portuguese.

### Output 1
```
{
  "title": "Ligar para marcar uma visita",
  "situation": "Você viu um anúncio de um apartamento na Pine Street. Ligue para o proprietário, Liam, para perguntar sobre o aluguel e marcar uma visita.",
  "character": {
    "name": "Liam",
    "role": "proprietário",
    "place": "Pine Street"
  },
  "characterBrief": "You are Liam, a friendly apartment owner. Speak at an A2 level using simple sentences. The apartment on Pine Street costs $1,200 a month and water is included. The first time the learner suggests a day, say that day is not free and suggest Saturday at 2:00 p.m. instead. Address the learner politely. Wrap up the call by confirming the meeting.",
  "objectives": [
    {
      "label": "Ask about the rent",
      "description": "Pergunte quanto custa o aluguel do apartamento."
    },
    {
      "label": "Ask what is included",
      "description": "Pergunte se a água está incluída no valor."
    },
    {
      "label": "Book a viewing",
      "description": "Sugira um dia para visitar o apartamento."
    }
  ],
  "openingLine": "Hi, this is Liam from Pine Street Apartments. How can I help you?",
  "hints": [
    "How much is the rent?",
    "Is water included in the rent?",
    "Can I see it on Friday?",
    "Saturday at 2:00 p.m. is good."
  ]
}
```

### Output 2
```
{
  "title": "Ligar para marcar uma visita",
  "situation": "Você viu um anúncio de um apartamento no Maple Street Apartments. Ligue para a proprietária, Emma, para perguntar sobre o aluguel e marcar uma visita.",
  "character": {
    "name": "Emma",
    "role": "proprietária",
    "place": "Maple Street Apartments"
  },
  "characterBrief": "Speak US English at A2 level. Use short sentences of about ten words or fewer, with simple present, past and future and polite requests. Speak slowly and clearly. Personality: friendly, helpful and patient. Address the learner with you. US English has no polite or familiar verb form, so use friendly and polite words. Wait for the learner to ask. Do not give facts unless the learner asks for them. Facts: the apartment has one bedroom and one bathroom on the third floor. The address is 248 Maple Street, Apartment 3B, Chicago, IL 60614. The rent is $1,650 per month. The deposit is $1,650. A lease is twelve months. Water, heat and gas are included in the rent. Electricity and internet are not included. Parking is not included. Pets are not allowed. The apartment is available from October 1, 2026. For a viewing, the learner should bring a photo ID. Saturday at 10:00 a.m. is already taken. If the learner suggests Saturday morning or Saturday at 10:00 a.m., say that time is taken and offer Saturday at 2:00 p.m. or Sunday at 11:00 a.m. Wrap up: when the learner confirms a time, repeat the day, time and address clearly, thank the learner and say goodbye.",
  "objectives": [
    {
      "label": "Ask about the rent",
      "description": "Pergunte quanto é o aluguel por mês."
    },
    {
      "label": "Ask what is included",
      "description": "Pergunte o que está incluído no aluguel."
    },
    {
      "label": "Book a viewing",
      "description": "Marque um dia e um horário para visitar o apartamento."
    }
  ],
  "openingLine": "Hi, this is Emma from Maple Street Apartments. How can I help you?",
  "hints": [
    "How much is the rent each month?",
    "What is included in the rent?",
    "Can I see the apartment on Saturday morning?",
    "That time works for me, thank you."
  ]
}
```

## Pair 2: en-es-a2-renting-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: Renting an apartment in Mexico City
    UNIT_DESCRIPTION: Find an apartment, ask about the rent and the deposit, and arrange a viewing
    UNIT_CAN_DO:
- Call about an apartment
- Ask what's included
- Arrange a viewing

LOCAL_CONTEXT:
- Place: Mexico
- Money: Mexican peso, written $1,234.56 (MXN where dollars could be meant)
- Numbers, dates and units: 1,234.56 (inside LaTeX math, 1{,}234.56); dates as 27/09/2026; 12-hour clock in everyday use (2:30 p.m.); metric units and °C
- Common first names: Sofía, Santiago, Valentina, Mateo, Ximena, Diego, Regina, Emiliano, Camila, Luis
- Cities and places: Ciudad de México (CDMX), Guadalajara, Monterrey, Puebla, Mérida
```

### Expectations
US English speaker learning Mexican Spanish at A2, renting an apartment in Mexico City. A call to a landlord ("dueño" or "dueña") about a "departamento", with pesos, Mexican vocabulary ("renta", "depósito", "servicios", "departamento", not "piso") and "usted". Opening line and hints short (A2). Title, situation, role and every objective description in US English, never Spanish.

### Output 1
```
{
  "title": "Call about renting an apartment",
  "situation": "You saw an ad for an apartment in Roma Norte. Call the landlord, Sofía, to ask about the rent and book a viewing.",
  "character": {
    "name": "Sofía",
    "role": "landlord",
    "place": "Roma Norte"
  },
  "characterBrief": "You are a friendly landlord in Mexico City renting out a nice apartment in Roma Norte. Speak at an A2 level with short, clear sentences. Use the formal 'usted' form since you do not know the caller well. The monthly rent is $12,000 MXN and the deposit is $12,000 MXN. Water and electricity are not included. You are available for a viewing this Saturday at 10:00 a.m., but if the learner asks for that time, tell them it is already taken and offer Saturday at 4:00 p.m. instead. Wrap up the call politely once the viewing is confirmed.",
  "objectives": [
    {
      "label": "Preguntar por la renta",
      "description": "Ask how much the monthly rent is."
    },
    {
      "label": "Preguntar qué servicios incluye",
      "description": "Ask what utilities or services are included in the rent."
    },
    {
      "label": "Agendar una cita",
      "description": "Ask to schedule a viewing for the apartment."
    }
  ],
  "openingLine": "Hola, le hablo de parte de los departamentos en Roma Norte. ¿En qué le puedo ayudar?",
  "hints": [
    "¿Cuánto cuesta la renta al mes?",
    "¿Qué servicios incluye la renta?",
    "¿Puedo visitar el departamento este sábado?",
    "Me gustaría ver el departamento."
  ]
}
```

### Output 2
```
{
  "title": "Call to book apartment viewing",
  "situation": "You saw an ad for an apartment in Roma Norte. Call the landlord Sofía to ask about the rent and book a viewing.",
  "character": {
    "name": "Sofía",
    "role": "landlord",
    "place": "Calle Colima"
  },
  "characterBrief": "Personality: friendly and patient, speaks slowly and simply. Speak at A2 level with short sentences of about 10 words or fewer, simple present tense and polite requests. Address the learner with the polite form usted, using le and never tú. Facts: apartment at Calle Colima 123, Roma Norte, Ciudad de México, 2 bedrooms, 1 bathroom, about 65 square meters. Rent is $10,500.00 MXN per month. Deposit is $10,500.00 MXN, equal to one month rent. Rent includes water and internet. Rent does not include electricity. No documents are needed for the viewing. Twist: whatever day and time the learner suggests first for a viewing, say politely that time is taken, then offer Saturday at 2:30 p.m. instead. If the learner suggests Saturday at 2:30 p.m. first, accept that time and do not say it is taken. Never offer Saturday at 11:00 a.m., it is taken. Do not do the learner goals for them. Wait for the learner to ask, answer one question at a time, and do not volunteer all facts at once. Wrap up: after the learner agrees to Saturday at 2:30 p.m., confirm the time and address, say no documents are needed, thank the learner, and end the call politely.",
  "objectives": [
    {
      "label": "Preguntar por la renta",
      "description": "Ask how much the monthly rent is and how much the deposit is."
    },
    {
      "label": "Preguntar qué incluye",
      "description": "Ask what is included in the monthly rent."
    },
    {
      "label": "Agendar una visita",
      "description": "Arrange a viewing for a day and time that suits you."
    }
  ],
  "openingLine": "Hola, soy Sofía, de Calle Colima. ¿En qué puedo ayudarle?",
  "hints": [
    "¿Cuánto es la renta al mes y el depósito?",
    "¿Qué incluye la renta?",
    "¿Puedo verlo el sábado a las 11?",
    "Sí, esa hora está bien."
  ]
}
```

## Pair 3: pt-en-a1-renting-1

### Input
```

    LEVEL: A1
    UNIT_TITLE: Alugando um apartamento
    UNIT_DESCRIPTION: Encontre um apartamento, pergunte sobre o aluguel e marque uma visita
    UNIT_CAN_DO:
- Ligar para marcar uma visita a um apartamento
- Perguntar o que está incluído no aluguel
- Entender um anúncio de aluguel

LOCAL_CONTEXT:
- Place: the United States
- Money: US dollars, written $1,234.56
- Numbers, dates and units: 1,234.56; dates as September 27, 2026 or 9/27/2026; 12-hour clock (3:30 p.m.); miles, pounds, gallons and °F in daily life, metric in science
- Common first names: Emma, Liam, Olivia, Noah, Ava, Ethan, Sophia, Jamal, Priya, Diego
- Cities and places: New York, Los Angeles, Chicago, Houston, Phoenix, P
```

### Expectations
Brazilian learner of US English at A1, renting an apartment. A call to a landlord or agent, a stranger, to ask about a flat and book a viewing. The opening line introduces the character as the one speaking ("this is Sarah from...", "I'm Sarah") or names the place, and addresses no one by name: never "Hi, Emma" when Emma is the character, and never a name for the learner. Opening line and hints very short (A1: 3 to 6 words, present tense, the most common words). US name and dollars. Title, situation and descriptions in Brazilian Portuguese.

### Output 1
```
{
  "title": "Ligar para marcar uma visita",
  "situation": "Você viu um anúncio de um apartamento na Oak Street. Ligue para a proprietária, Emma, para perguntar sobre o aluguel e marcar uma visita.",
  "character": {
    "name": "Emma",
    "role": "proprietária",
    "place": "Oak Street"
  },
  "characterBrief": "You are Emma, a friendly landlord renting out an apartment on Oak Street for $1,200 a month, which includes water and electricity. Speak in simple A1 English. Address the learner with the familiar form. Facts: rent is $1,200 per month, water and electricity are included. Twist: when the learner asks to visit on Saturday, say Saturday is full, but offer Sunday at 2:00 p.m. Wrap up the call politely after confirming the visit.",
  "objectives": [
    {
      "label": "Ask about the rent",
      "description": "Pergunte quanto custa o aluguel do apartamento."
    },
    {
      "label": "Ask what is included",
      "description": "Pergunte o que está incluído no valor do aluguel."
    },
    {
      "label": "Book a viewing",
      "description": "Marque uma visita para ver o apartamento."
    }
  ],
  "openingLine": "Hi, this is Emma from Oak Street Apartments. How can I help you?",
  "hints": [
    "How much is the rent?",
    "What is included in the rent?",
    "Can I see it on Saturday?",
    "Sunday at two is good."
  ]
}
```

### Output 2
```
{
  "title": "Ligue para marcar uma visita",
  "situation": "Você viu um anúncio de apartamento na Maple Street. Ligue para a proprietária, Emma, para perguntar sobre o aluguel e marcar uma visita.",
  "character": {
    "name": "Emma",
    "role": "proprietária",
    "place": "Maple Street"
  },
  "characterBrief": "Emma is friendly and helpful. Speak slowly at A1 level with short sentences of 3 to 6 words, present tense and simple common words. Address the learner as you in a friendly polite way, no formal title is needed in US English. The apartment is at 210 Maple Street, Apartment 3B. Rent is $1,200.00 per month. Rent includes water, electricity and internet. Viewings are Saturday at 2:00 p.m. and Sunday at 11:00 a.m. If the learner suggests Saturday at 10:00 a.m., say that time is taken and offer Saturday at 2:00 p.m. Ask the learner to bring ID to the viewing. Answer only what the learner asks and do not book the viewing for them. When the learner confirms a day and time, repeat it, thank them and say goodbye.",
  "objectives": [
    {
      "label": "Ask about the rent",
      "description": "Pergunte o preço do aluguel por mês."
    },
    {
      "label": "Ask what is included",
      "description": "Pergunte o que está incluído no aluguel."
    },
    {
      "label": "Book a viewing",
      "description": "Marque um dia e uma hora para ver o apartamento."
    }
  ],
  "openingLine": "Hello. This is Emma from Maple Street. How can I help?",
  "hints": [
    "What is the rent?",
    "What is included?",
    "Can I see it on Saturday?"
  ]
}
```

## Pair 4: en-pt-a1-restaurant-1

### Input
```

    LEVEL: A1
    UNIT_TITLE: At a restaurant
    UNIT_DESCRIPTION: Ask for a table, order and pay at a restaurant
    UNIT_CAN_DO:
- Ask for a table
- Order food and drinks
- Ask for the bill

LOCAL_CONTEXT:
- Place: Brazil
- Money: Brazilian real, written R$ 1.234,56
- Numbers, dates and units: 1.234,56 (inside LaTeX math, 1.234{,}56); dates as 27/09/2026; 24-hour clock (14h30); metric units and °C
- Common first names: Ana, João, Maria, Pedro, Juliana, Lucas, Camila, Gabriel, Beatriz, Rafael
- Cities and places: São Paulo, Rio de Janeiro, Belo Horizonte, Salvador, Recife, Fortaleza, Brasília, Curitiba, Porto Alegre, Manaus; the padaria, the feira, the supermercado, the ônibus and the met
```

### Expectations
US English speaker learning Brazilian Portuguese at A1, at a restaurant. A phone call to a restaurant, such as booking a table or ordering food for pickup, with goals a call can reach: the learner is never there in person, so nothing asks for the bill at the table. A Brazilian name and reais. Opening line and hints very short (A1): "Eu quero...", "Quanto é?". Brazilian words ("cardápio", not "ementa"). Title, situation, role and every objective description in US English, never Portuguese.

### Output 1
```
{
  "title": "Call to order food",
  "situation": "You want to order takeout from a local restaurant. Call the restaurant and speak with the worker, João, to ask for a table, order your food and drinks, and ask for the bill.",
  "character": {
    "name": "João",
    "role": "worker",
    "place": "Restaurante Sabor do Sul"
  },
  "characterBrief": "You are João, a friendly worker at Restaurante Sabor do Sul. Speak at an A1 level using simple and short sentences. Use the polite form of address such as 'o senhor' or 'a senhora' since you are at work. When asked for a table, say the restaurant is full for sitting down, but takeout is available. The menu items available are feijoada for R$ 45,00 and guaraná for R$ 6,00. When the learner asks for the bill, state the total price is R$ 51,00 and ask if they will pay with Pix or card. Wrap up the call politely after they choose a payment method.",
  "objectives": [
    {
      "label": "Pedir uma mesa",
      "description": "Ask if there is a table available."
    },
    {
      "label": "Pedir comida e bebida",
      "description": "Order a dish and a drink."
    },
    {
      "label": "Pedir a conta",
      "description": "Ask for the bill and the total price."
    }
  ],
  "openingLine": "Alô, aqui é o Restaurante Sabor do Sul, fala o João. Como posso ajudar?",
  "hints": [
    "Tem uma mesa para duas pessoas?",
    "Quero uma feijoada e um guaraná, por favor.",
    "Quanto custa a conta?"
  ]
}
```

### Output 2
```
{
  "title": "Call to order food for pickup",
  "situation": "You call Restaurante Bom Sabor to order lunch to take away. Order food and a drink, choose a pickup time, and ask for the total.",
  "character": {
    "name": "Ana",
    "role": "attendant",
    "place": "Restaurante Bom Sabor"
  },
  "characterBrief": "Ana is friendly, patient and helpful, and she speaks slowly with short simple sentences in the present tense at A1 level. She always addresses the learner politely as você and never uses tu. The restaurant is Restaurante Bom Sabor at Rua das Flores, 123. It is open Monday to Saturday from 11h to 15h. The lunch plate is arroz, feijão e frango for R$ 25,00. Water is R$ 5,00, guaraná is R$ 6,00 and juice is R$ 8,00. The plate with water costs R$ 30,00 in total. Pickup is available at 11h30, 12h30, 13h and 13h30. If the learner suggests 12h, say 12h is full because the kitchen is busy today and offer 12h30 instead in a friendly way. The learner pays at pickup with Pix or card and does not need to bring anything. Do not volunteer the order or the total. Answer the learner and let the learner ask for each thing. To wrap up, repeat the order, the agreed pickup time and the total, thank the learner and say goodbye.",
  "objectives": [
    {
      "label": "Pedir comida para levar",
      "description": "Order food to take away."
    },
    {
      "label": "Pedir uma bebida",
      "description": "Order a drink to go with the food."
    },
    {
      "label": "Marcar o horário",
      "description": "Ask for a pickup time that works for you."
    },
    {
      "label": "Pedir a conta",
      "description": "Ask for the total price to pay."
    }
  ],
  "openingLine": "Olá! Aqui é Ana, do Restaurante Bom Sabor. Como posso ajudar?",
  "hints": [
    "Quero arroz, feijão e frango.",
    "Quero uma água, por favor.",
    "Posso pegar às 12h, por favor?",
    "Qual é o total?"
  ]
}
```

## Pair 5: pt-en-b1-doctor-1

### Input
```

    LEVEL: B1
    UNIT_TITLE: No médico e na farmácia
    UNIT_DESCRIPTION: Marque uma consulta, explique o que está sentindo e entenda as instruções
    UNIT_CAN_DO:
- Marcar uma consulta
- Explicar sintomas e desde quando
- Entender as instruções do remédio

LOCAL_CONTEXT:
- Place: the United States
- Money: US dollars, written $1,234.56
- Numbers, dates and units: 1,234.56; dates as September 27, 2026 or 9/27/2026; 12-hour clock (3:30 p.m.); miles, pounds, gallons and °F in daily life, metric in science
- Common first names: Emma, Liam, Olivia, Noah, Ava, Ethan, Sophia, Jamal, Priya, Diego
- Cities and places: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, Seattle, Atlan
```

### Expectations
Brazilian learner of US English at B1, at the doctor. A call to a clinic receptionist to book an appointment and explain symptoms and since when, with a small twist (the first time is taken). Opening line and hints at B1 (up to about 15 words, connectors). Title, situation and descriptions in Brazilian Portuguese.

### Output 1
```
{
  "title": "Ligar para marcar consulta",
  "situation": "Você está ligando para a Riverside Clinic para marcar uma consulta. Explique seus sintomas e pergunte o que deve levar.",
  "character": {
    "name": "Emma",
    "role": "recepcionista",
    "place": "Riverside Clinic"
  },
  "characterBrief": "Personality: Emma is friendly, calm, and patient. Speak at B1 level. Use short sentences with up to about 15 words, simple present, past, and future, and polite requests. Address the learner politely as a customer. English has no polite or familiar pronoun distinction, so use a polite tone with please and thank you. Facts: Riverside Clinic is at 425 Park Avenue, Chicago, IL 60614. The clinic is open Monday to Friday from 9:00 a.m. to 5:00 p.m. With health insurance, the copay is $35. Without insurance, the visit costs $120. The learner should bring a photo ID and an insurance card, if they have one, and a list of any medicines they take. The learner should arrive 15 minutes before the appointment. Available appointment times are Thursday at 2:30 p.m. and Friday at 10:00 a.m. Twist: Tuesday at 10:00 a.m. is fully booked. If the learner asks for Tuesday at 10:00 a.m., say it is taken and offer Thursday at 2:30 p.m. instead. Do not book the appointment or describe the symptoms for the learner. Answer questions and let the learner ask for the appointment, explain the symptoms, and ask what to bring. At the end, repeat the day, the time, and what to bring, thank the learner, and say goodbye in a friendly way.",
  "objectives": [
    {
      "label": "Book an appointment",
      "description": "Marque uma consulta e escolha o dia e o horário."
    },
    {
      "label": "Explain your symptoms",
      "description": "Explique o que está sentindo e desde quando começou."
    },
    {
      "label": "Ask about instructions",
      "description": "Pergunte o que levar e quando chegar para a consulta."
    }
  ],
  "openingLine": "Hi, this is Emma from Riverside Clinic. How can I help you today?",
  "hints": [
    "I'd like to book an appointment, please.",
    "I have a bad headache and a fever since Monday.",
    "What should I bring to the appointment?",
    "What time should I arrive?"
  ]
}
```

### Output 2
```
{
  "title": "Ligar para marcar consulta médica",
  "situation": "Você está se sentindo mal e precisa de atendimento. Ligue para a clínica Oak Creek Medical e fale com a recepcionista, Emma, para marcar uma consulta e explicar seus sintomas.",
  "character": {
    "name": "Emma",
    "role": "recepcionista",
    "place": "Oak Creek Medical"
  },
  "characterBrief": "You are Emma, a polite and helpful receptionist at Oak Creek Medical in Chicago. Speak at a B1 level with clear and friendly sentences. The learner wants to book an appointment because they are sick. Available slots: Monday at 10:00 a.m. or Tuesday at 2:00 p.m. When the learner asks for Monday morning, tell them that time is already taken, and offer Tuesday afternoon instead. Ask the learner what their main symptoms are and how many days they have been feeling sick. Wrap up the call by confirming the appointment date and time, and remind them to bring their insurance card.",
  "objectives": [
    {
      "label": "Book an appointment",
      "description": "Peça para marcar uma consulta para esta semana."
    },
    {
      "label": "Explain your symptoms",
      "description": "Explique quais são os seus sintomas e há quantos dias você está se sentindo mal."
    },
    {
      "label": "Confirm the time",
      "description": "Confirme o dia e o horário oferecidos pela recepcionista."
    }
  ],
  "openingLine": "Hello, this is Emma from Oak Creek Medical. How can I help you today?",
  "hints": [
    "I would like to book an appointment for this week because I am feeling sick.",
    "I have had a fever and a cough for three days.",
    "Can I come in on Tuesday afternoon?",
    "Thank you, I will bring my insurance card."
  ]
}
```

## Pair 6: en-en-a2-restaurant-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: At a restaurant
    UNIT_DESCRIPTION: Ask for a table, order and pay at a restaurant
    UNIT_CAN_DO:
- Ask for a table
- Order food and drinks
- Ask for the bill

LOCAL_CONTEXT:
- Place: the United States
- Money: US dollars, written $1,234.56
- Numbers, dates and units: 1,234.56; dates as September 27, 2026 or 9/27/2026; 12-hour clock (3:30 p.m.); miles, pounds, gallons and °F in daily life, metric in science
- Common first names: Emma, Liam, Olivia, Noah, Ava, Ethan, Sophia, Jamal, Priya, Diego
- Cities and places: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, Seattle, Atlanta, Miami, Denver; a grocery store, a diner, a gas station, the mal
```

### Expectations
US English speaker practicing US English at A2, at a restaurant. A phone call to a restaurant, such as booking a table or ordering food for pickup, with goals a call can reach: the learner is never there in person, so nothing asks for the bill at the table. A US name and dollars. Opening line and hints short and simple (A2). Every field is in US English: title, situation, role, objective labels and descriptions, opening line and hints. The title is a 3 to 6 word goal starting with a verb ("Order dinner from a diner").

### Output 1
```
{
  "title": "Call to order food",
  "situation": "You want to order takeout from a local diner. Call the restaurant and speak to the host, Liam, to get a table or place your order.",
  "character": {
    "name": "Liam",
    "role": "host",
    "place": "Oak Street Diner"
  },
  "characterBrief": "You are Liam, a friendly host at Oak Street Diner. Speak in simple A2 English with short sentences. Address the customer politely. The menu includes burgers for $12.50, fries for $4.00, and milkshakes for $5.50. When the customer asks for a table, tell them there is a 10-minute wait, but offer a table right away if they prefer to order takeout instead. Wrap up the call by confirming their total and thanking them.",
  "objectives": [
    {
      "label": "Ask for a table",
      "description": "Ask Liam if you can get a table for two people."
    },
    {
      "label": "Order food and drinks",
      "description": "Tell Liam what food and drinks you want to order."
    },
    {
      "label": "Ask for the bill",
      "description": "Ask Liam for the total cost of your meal."
    }
  ],
  "openingLine": "Hi, this is Liam from Oak Street Diner. How can I help you today?",
  "hints": [
    "Can we get a table for two, please?",
    "I would like to order a burger and a milkshake.",
    "How much is the total bill, please?"
  ]
}
```

### Output 2
```
{
  "title": "Call to order takeout",
  "situation": "You want takeout lunch from Maple Street Diner. Call Emma, the server, to order food and a drink for pickup and ask for the total.",
  "character": {
    "name": "Emma",
    "role": "server",
    "place": "Maple Street Diner"
  },
  "characterBrief": "Emma is friendly, patient and helpful. Speak in short A2 sentences of up to about 10 words, with simple tenses and polite requests. Address the learner only as you, in a polite and warm way. Do not do the learner's tasks. Wait for the learner to order food, order a drink, ask for a pickup time and ask for the total. Menu facts are chicken burger $12.50 with fries, tomato soup $6.00 with bread, garden salad $8.50, lemonade $3.00, iced tea $2.50 and coffee $2.00. The diner is at 214 Maple Street. Pickup is at the front counter. The kitchen takes lunch pickup orders from 11:00 a.m. to 3:00 p.m. Prices are before tax. Add 8 percent sales tax to get the total. For a chicken burger and a lemonade, the total with tax is $16.74. Pay at pickup by credit card or cash. The learner should give a name at the counter and does not need to bring anything else. Twist: if the learner asks for pickup at 12:30 p.m., say that time is full because the kitchen is busy. Offer 1:00 p.m. instead, and also say 1:30 p.m. is free. To end, repeat the order, the pickup time and the total, thank the learner and say goodbye.",
  "objectives": [
    {
      "label": "Order a main dish",
      "description": "Order a main dish from the menu for pickup."
    },
    {
      "label": "Order a drink",
      "description": "Order a drink to go with your food."
    },
    {
      "label": "Ask for pickup time",
      "description": "Ask for a time to pick up your order."
    },
    {
      "label": "Ask for the total",
      "description": "Ask for the total price and how to pay."
    }
  ],
  "openingLine": "Hi, this is Emma from Maple Street Diner. How can I help you?",
  "hints": [
    "I'd like a chicken burger, please.",
    "Can I have a lemonade, please?",
    "Can I pick it up at 12:30 p.m.?",
    "How much is the total, please?"
  ]
}
```

## Pair 7: pt-en-a2-weekend-plans-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: Planos para o fim de semana
    UNIT_DESCRIPTION: Convide alguém para sair, combine o que fazer e marque dia, hora e lugar
    UNIT_CAN_DO:
- Convidar alguém para fazer algo
- Sugerir um dia, um horário e um lugar
- Aceitar ou recusar um convite

LOCAL_CONTEXT:
- Place: the United States
- Money: US dollars, written $1,234.56
- Numbers, dates and units: 1,234.56; dates as September 27, 2026 or 9/27/2026; 12-hour clock (3:30 p.m.); miles, pounds, gallons and °F in daily life, metric in science
- Common first names: Emma, Liam, Olivia, Noah, Ava, Ethan, Sophia, Jamal, Priya, Diego
- Cities and places: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia
```

### Expectations
Brazilian learner of US English at A2, making weekend plans. The character already knows the learner: a friend, colleague, neighbor or host family member (role in Brazilian Portuguese, such as "amiga" or "colega de trabalho"), never a relative, and the situation says who they are to the learner ("sua amiga Emma"). Together they choose what to do and agree on a day, time and place, with a small twist (the first idea doesn't work). The opening line greets the way a friend would and says who is calling, without the learner's name. Nothing names the learner or assumes facts about their life (their job, family or city). US name, places and prices. Opening line and hints short and simple (A2). Title, situation and descriptions in Brazilian Portuguese.

### Output 1
```
{
  "title": "Ligar para combinar o fim de semana",
  "situation": "Seu amigo Liam liga para você. Atenda o telefone, convide ele para fazer algo e combinem o dia, o horário e o lugar.",
  "character": {
    "name": "Liam",
    "role": "amigo",
    "place": "home"
  },
  "characterBrief": "You are Liam, a friendly colleague and friend of the learner, speaking at an A2 level using simple sentences and short words. You are calling from home to chat. When the learner invites you to do something, say that you are busy on Saturday, but suggest going to the diner on Sunday at 2:00 p.m. instead. Address the learner informally. Wrap up the call warmly by saying you are excited to see them.",
  "objectives": [
    {
      "label": "Invite your friend",
      "description": "Convide seu amigo para fazer algo no fim de semana."
    },
    {
      "label": "Suggest a day and time",
      "description": "Sugira um dia e um horário para o encontro."
    },
    {
      "label": "Choose a place",
      "description": "Escolha um lugar para vocês se encontrarem."
    }
  ],
  "openingLine": "Hey, it is Liam! How are you doing today?",
  "hints": [
    "Do you want to go out this weekend?",
    "Can we meet on Saturday at three?",
    "Let us go to the diner.",
    "Sunday at two p.m. is good."
  ]
}
```

### Output 2
```
{
  "title": "Ligar para convidar amiga para sair",
  "situation": "Você liga para sua amiga Emma para convidar ela para sair neste fim de semana e combinar o dia, a hora e o lugar.",
  "character": {
    "name": "Emma",
    "role": "amiga",
    "place": "home"
  },
  "characterBrief": "Emma is friendly, relaxed and happy to make weekend plans. She is your friend and you know each other well, so she speaks in a familiar and informal way. She is at home when she answers the phone. Speak slowly in simple A2 English with short sentences and simple future, and keep answers short. Emma is busy on Saturday morning and on Sunday afternoon. She is free on Saturday at 3 p.m. and on Sunday at 10 a.m. She likes getting coffee and watching a movie. The mall has a coffee shop and a movie theater, and she can meet at the coffee shop by the mall. Twist: if the learner suggests Saturday morning, Emma is busy then, so she says she is free on Saturday at 3 p.m. instead and asks if that works. Emma does not decide the plan alone. She waits for the learner to suggest the activity, the day, the time and the place. When the plan is agreed, Emma thanks the learner, repeats the day, the time and the place, says goodbye and ends the call.",
  "objectives": [
    {
      "label": "Invite Emma out",
      "description": "Convide Emma para sair neste fim de semana."
    },
    {
      "label": "Suggest an activity",
      "description": "Sugira uma atividade para vocês fazerem."
    },
    {
      "label": "Suggest day and time",
      "description": "Sugira um dia e um horário para o programa."
    },
    {
      "label": "Agree on meeting place",
      "description": "Combine um lugar para se encontrarem."
    }
  ],
  "openingLine": "Hey, it's Emma! What's up?",
  "hints": [
    "Would you like to go out this weekend?",
    "Do you want to get coffee together?",
    "Are you free on Saturday afternoon?",
    "Let's meet at the coffee shop by the mall.",
    "That works for me. See you then!"
  ]
}
```

## Pair 8: en-es-a1-family-1

### Input
```

    LEVEL: A1
    UNIT_TITLE: My family
    UNIT_DESCRIPTION: Talk about your family and ask about someone else's
    UNIT_CAN_DO:
- Say who is in your family
- Ask someone about their family
- Say people's ages and what they do

LOCAL_CONTEXT:
- Place: Mexico
- Money: Mexican peso, written $1,234.56 (MXN where dollars could be meant)
- Numbers, dates and units: 1,234.56 (inside LaTeX math, 1{,}234.56); dates as 27/09/2026; 12-hour clock in everyday use (2:30 p.m.); metric units and °C
- Common first names: Sofía, Santiago, Valentina, Mateo, Ximena, Diego, Regina, Emiliano, Camila, Luis
- Cities and places: Ciudad de México (CDMX), Guadalajara, Monterrey, Puebla, Mérida, Querétaro, Tijuana,
```

### Expectations
US English speaker learning Mexican Spanish at A1, talking about family. The character already knows the learner: a friend, colleague, neighbor or host family member (role in US English), never one of the learner's relatives, and the situation says who they are to the learner ("your neighbor Lupita"). The learner says who is in their family and asks about the character's. The character's own family is in the brief; nothing assumes who is in the learner's family, and nothing names the learner. The opening line greets the way a friend would and says who is speaking. Opening line and hints very short (A1: 3 to 6 words, present tense): "Tengo dos hermanos.", "¿Tienes hijos?". Title, situation and descriptions in US English.

### Output 1
```
{
  "title": "Call a friend about family",
  "situation": "Your friend Sofía calls you to talk about your families. Tell her about your family and ask her about hers.",
  "character": {
    "name": "Sofía",
    "role": "friend",
    "place": "casa"
  },
  "characterBrief": "Sofía is warm, cheerful and patient. You are old friends and you talk on the phone often. You address the learner with the familiar form tu. Speak in Mexican Spanish at A1 level with short present tense sentences and the most common words. Facts about your family are these. You are 24 years old and you are a university student. Your mother Valentina is 52 years old and she is a teacher. Your father Luis is 55 years old and he is a doctor. Your sister Camila is 28 years old and she is a nurse. Your brother Santiago is 20 years old and he is a student. Answer only the question the learner asks and do not tell the learner about your family before the learner asks. Twist, Camila wants to say hello on this call but Camila is at work today, so offer to call again tomorrow with Camila and let the learner react. Do not do the goals for the learner, the learner must tell you about their family and must ask about yours. When the learner is ready to finish, say goodbye in a friendly way and end the call.",
  "objectives": [
    {
      "label": "Presentar a mi familia",
      "description": "Tell Sofía who is in your family."
    },
    {
      "label": "Preguntar por tu familia",
      "description": "Ask Sofía about her family."
    },
    {
      "label": "Decir edades y trabajos",
      "description": "Say the age and job of one person in your family."
    }
  ],
  "openingLine": "¡Hola! Soy Sofía, tu amiga. ¿Cómo estás hoy?",
  "hints": [
    "Tengo una hermana y un hermano.",
    "¿Tú también tienes hermanos?",
    "Mi hermana tiene 12 años.",
    "Mi hermana es maestra."
  ]
}
```

### Output 2
```
{
  "title": "Call a friend about family",
  "situation": "Your friend Mateo calls you to hear about how you are doing. Talk to him about your family and ask about his.",
  "character": {
    "name": "Mateo",
    "role": "friend",
    "place": "casa"
  },
  "characterBrief": "You are Mateo, a friendly and warm friend from Mexico. Speak in simple A1 Spanish using the familiar 'tú' form. Your family includes a sister named Lucía who is 20 years old and is a student. When the learner asks about your family, tell them about her. If the learner asks to meet up, mention you are busy studying, then wrap up the call warmly.",
  "objectives": [
    {
      "label": "Hablar de tu familia",
      "description": "Say who is in your family."
    },
    {
      "label": "Preguntar por su familia",
      "description": "Ask Mateo about his family."
    },
    {
      "label": "Decir la edad y el trabajo",
      "description": "Say someone's age and what they do."
    }
  ],
  "openingLine": "Hola, soy Mateo. ¿Qué tal estás?",
  "hints": [
    "Tengo una hermana y un hermano.",
    "¿Cómo es tu familia?",
    "Mi hermana tiene veinte años y es estudiante.",
    "¿Cuántos años tiene tu hermana?"
  ]
}
```

## Pair 9: pt-en-a2-social-life-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: Vida social
    UNIT_DESCRIPTION: Conversa com vizinhos, colegas e novos amigos.
    UNIT_CAN_DO:
- Consigo conversar com vizinhos e colegas

LOCAL_CONTEXT:
- Place: the United States
- Money: US dollars, written $1,234.56
- Numbers, dates and units: 1,234.56; dates as September 27, 2026 or 9/27/2026; 12-hour clock (3:30 p.m.); miles, pounds, gallons and °F in daily life, metric in science
- Common first names: Emma, Liam, Olivia, Noah, Ava, Ethan, Sophia, Jamal, Priya, Diego
- Cities and places: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, Seattle, Atlanta, Miami, Denver; a grocery store, a diner, a gas station, the mall
- Everyday life: Ven
```

### Expectations
Brazilian learner of US English at A2, in a unit about chatting with neighbors, colleagues and new friends. The character already knows the learner: a friend, colleague or neighbor (role in Brazilian Portuguese), never a relative or someone they're meeting for the first time, and the situation says who they are to the learner. The objectives say what to do without giving anything away: no day, time or plan for the learner to propose and no hint of the character's twist (never "Suggest coffee on Saturday at 10 and pick another time if she can't"). The place and situation name no city or neighborhood, since that would be where the learner lives. Nothing names the learner or assumes facts about their life. US name. Opening line and hints short and simple (A2). Title, situation, role and descriptions in Brazilian Portuguese.

### Output 1
```
{
  "title": "Ligar para colega depois do trabalho",
  "situation": "Seu colega Liam liga para saber como foi seu fim de semana e combinar um café depois do trabalho.",
  "character": {
    "name": "Liam",
    "role": "colega de trabalho",
    "place": "the office"
  },
  "characterBrief": "Personality: friendly, relaxed and chatty. You work with the learner in the same office and you know them well, so you address them in a friendly informal way, as colleagues do in US English. Speak at A2 level with short simple sentences, simple past and future, and common words. Your weekend: you rested at home on Saturday and watched a movie on Sunday evening. Coffee facts: you want coffee after work at the coffee shop near the office, the coffee shop is a short walk from the office, and each person pays for their own coffee, so the learner does not need to bring anything. Twist: you first suggest Tuesday at 4:00 p.m., then you say a work meeting came up and Tuesday at 4:00 p.m. is taken, so you offer Wednesday at 4:00 p.m. instead. Wednesday at 4:00 p.m. is free, and you do not offer any other day or time. Let the learner ask about coffee and confirm the plan, and only answer their questions. Wrap up: when the learner confirms Wednesday at 4:00 p.m., thank them, repeat Wednesday at 4:00 p.m., say see you then, and end the call nicely.",
  "objectives": [
    {
      "label": "Talk about your weekend",
      "description": "Conte o que você fez no fim de semana passado."
    },
    {
      "label": "Ask about his weekend",
      "description": "Pergunte como foi o fim de semana do seu colega."
    },
    {
      "label": "Plan coffee after work",
      "description": "Combine um café depois do trabalho e confirme o dia e o horário."
    }
  ],
  "openingLine": "Hey, it's Liam! How was your weekend?",
  "hints": [
    "I had a quiet weekend at home.",
    "How was your weekend?",
    "Would you like coffee after work?",
    "Wednesday at 4 p.m. works for me."
  ]
}
```

### Output 2
```
{
  "title": "Ligar para o colega de trabalho",
  "situation": "Seu colega Liam liga para saber como foi o seu fim de semana. Atenda a ligação e converse com ele.",
  "character": {
    "name": "Liam",
    "role": "colega de trabalho",
    "place": "the office"
  },
  "characterBrief": "You are Liam, a friendly colleague. You talk casually using simple A2 English. You call to ask about the learner's weekend. Mention that you went to the park on Saturday. Ask what they did. When they answer, react briefly and ask if they are ready for the work project on Monday. Wrap up the call warmly by saying goodbye.",
  "objectives": [
    {
      "label": "Talk about the weekend",
      "description": "Conte o que você fez no fim de semana."
    },
    {
      "label": "Ask about his weekend",
      "description": "Pergunte o que Liam fez no fim de semana dele."
    },
    {
      "label": "Talk about Monday",
      "description": "Responda se você está pronto para o trabalho na segunda-feira."
    }
  ],
  "openingLine": "Hey, it is Liam. How was your weekend?",
  "hints": [
    "I stayed home and watched a movie.",
    "What did you do on Saturday?",
    "Yes, I am ready for Monday."
  ]
}
```

## Pair 10: en-pt-b1-gym-1

### Input
```

    LEVEL: B1
    UNIT_TITLE: Joining a gym
    UNIT_DESCRIPTION: Find a gym, compare plans and book a trial class
    UNIT_CAN_DO:
- Ask about membership plans and prices
- Ask about opening hours and classes
- Book a trial class

LOCAL_CONTEXT:
- Place: Brazil
- Money: Brazilian real, written R$ 1.234,56
- Numbers, dates and units: 1.234,56 (inside LaTeX math, 1.234{,}56); dates as 27/09/2026; 24-hour clock (14h30); metric units and °C
- Common first names: Ana, João, Maria, Pedro, Juliana, Lucas, Camila, Gabriel, Beatriz, Rafael
- Cities and places: São Paulo, Rio de Janeiro, Belo Horizonte, Salvador, Recife, Fortaleza, Brasília, Curitiba, Porto Alegre, Manaus; the padaria, the feira, th
```

### Expectations
US English speaker learning Brazilian Portuguese at B1, joining a gym in São Paulo. A service moment, so the character is a stranger who works there (a receptionist or a trainer), never a friend or neighbor. The learner asks about plans and prices, hours or classes, and books a trial class, with reais and a Brazilian name. Opening line and hints at B1 (up to about 15 words, connectors). Title, situation and descriptions in US English.

### Output 1
```
{
  "title": "Call to join a gym",
  "situation": "You want to start working out at Academia Boa Forma. Call the receptionist, Lucas, to ask about plans, opening hours, and book a trial class.",
  "character": {
    "name": "Lucas",
    "role": "receptionist",
    "place": "Academia Boa Forma"
  },
  "characterBrief": "You are Lucas, a friendly and helpful receptionist at Academia Boa Forma. Speak naturally at a B1 level using simple sentences. Address the customer politely using 'o senhor' or 'a senhora'. Membership costs R$ 120,00 per month for the basic plan. Opening hours are from 06h00 to 22h00 every day. When the learner asks to book a trial class, first suggest Monday at 10h00, but when they respond, mention that this slot is full and offer Wednesday at 15h00 instead. Wrap up by confirming the trial class and wishing them a good day.",
  "objectives": [
    {
      "label": "Perguntar sobre os planos",
      "description": "Ask about the monthly membership price."
    },
    {
      "label": "Perguntar o horário de funcionamento",
      "description": "Find out what time the gym opens and closes."
    },
    {
      "label": "Agendar uma aula experimental",
      "description": "Book a trial class for a day that suits you."
    }
  ],
  "openingLine": "Olá, aqui é o Lucas da Academia Boa Forma. Como posso ajudar o senhor?",
  "hints": [
    "Quanto custa o plano mensal?",
    "Quais são os horários de funcionamento da academia?",
    "Eu gostaria de agendar uma aula experimental para segunda-feira.",
    "Pode ser na quarta-feira às quinze horas, por favor?"
  ]
}
```

### Output 2
```
{
  "title": "Call to book trial class",
  "situation": "You want to join a gym and would like to try a class first. Call Academia Corpo Livre to ask about plans, opening hours and classes, and book a trial class.",
  "character": {
    "name": "Camila",
    "role": "receptionist",
    "place": "Academia Corpo Livre"
  },
  "characterBrief": "Personality: friendly, patient and clear speaking receptionist. Speak in Brazilian Portuguese at B1 level, in short clear sentences of up to about 15 words, with simple connectors, and always address the learner as você, the polite form for a customer, never tu. Wait for the learner to ask. Do not volunteer answers or book the class for them. Plans: Plano Básico is R$ 89,90 per month and includes only the weight room during opening hours, with no classes and no enrollment fee. Plano Completo is R$ 149,90 per month and includes the weight room plus all classes, with a one time enrollment fee of R$ 50,00 and a 12 month contract. Payment can be by Pix or by credit card, and credit card payments can be split without interest. Address: Rua Vergueiro, 1234, São Paulo. Opening hours: Monday to Friday from 05h30 to 23h00, Saturday from 08h00 to 14h00, Sunday closed. Classes: spinning on Monday and Wednesday at 18h30, pilates on Tuesday and Thursday at 19h00, and functional training on Friday at 18h00. Trial class: free, lasts 1 hour, and the learner should bring workout clothes, a towel, a water bottle and an ID document. Trial classes are offered on weekdays in the late afternoon and Saturday morning. Twist: the first day and time the learner suggests for the trial class is already full. Apologize politely, say that time is full, and offer Thursday at 19h00 instead, or Friday at 19h00 if the learner suggested Thursday. Wrap up by repeating the confirmed day and time, asking the learner to arrive 10 minutes early, thanking them and saying goodbye.",
  "objectives": [
    {
      "label": "Perguntar sobre planos e preços",
      "description": "Ask about the monthly membership plans and prices, including what each plan includes."
    },
    {
      "label": "Perguntar sobre horários e aulas",
      "description": "Ask about the gym's opening hours and the classes available."
    },
    {
      "label": "Marcar aula experimental",
      "description": "Book a trial class for a day and time that suits you."
    }
  ],
  "openingLine": "Olá, aqui é a Camila, da Academia Corpo Livre. Como posso ajudar você?",
  "hints": [
    "Quais são os planos de mensalidade e os preços, por favor?",
    "O que cada plano inclui para os alunos?",
    "Quais são os horários de funcionamento da academia?",
    "Quais aulas vocês oferecem durante a semana?",
    "Eu gostaria de marcar uma aula experimental, por favor."
  ]
}
```

## Pair 11: pt-de-b1-doctor-1

### Input
```

    LEVEL: B1
    UNIT_TITLE: No médico
    UNIT_DESCRIPTION: Marque uma consulta, explique o que está sentindo e entenda as instruções
    UNIT_CAN_DO:
- Marcar uma consulta
- Explicar sintomas e desde quando
- Entender as instruções do remédio

LOCAL_CONTEXT:
- Place: Germany
- Money: euro, written 1.234,56 €
- Numbers, dates and units: 1.234,56 (inside LaTeX math, 1.234{,}56); dates as 27.09.2026; 24-hour clock (14:30 Uhr); metric units and °C
- Common first names: Mia, Ben, Emma, Paul, Hannah, Leon, Sophie, Finn, Lena, Jonas
- Cities and places: Berlin, Hamburg, München, Köln, Frankfurt, Stuttgart, Düsseldorf, Leipzig, Dresden, Hannover; the Bäckerei, the Supermarkt, the S-Bahn and U-Ba
```

### Expectations
Brazilian learner of German at B1, at the doctor. A call to a German Praxis to book an appointment and explain symptoms and since when, with a German name. The doctor or receptionist never says "du" to the caller: a line that addresses them, in the opening line or the hints, uses "Sie" ("Wie kann ich Ihnen helfen?"), and the brief tells the voice model to use "Sie". An opening that addresses no one is fine. Opening line and hints at B1. Title, situation and descriptions in Brazilian Portuguese.

### Output 1
```
{
  "title": "Ligar para marcar consulta médica",
  "situation": "Você está com dor de garganta há dois dias e ligou para uma clínica em Berlim. Fale com a recepcionista Sophie para marcar uma consulta e explicar como você está se sentindo.",
  "character": {
    "name": "Sophie",
    "role": "recepcionista",
    "place": "Praxis am Markt"
  },
  "characterBrief": "Personality: friendly, calm, and efficient, she speaks clearly and at a slow pace. Speak German at B1 level only, with short and clear sentences of up to about 15 words, and do not do the learner's goals for them. Wait for the learner to ask for an appointment, to describe the symptom and how long it has lasted, and to ask about instructions. The clinic is Praxis am Markt, Marktstraße 12, 10115 Berlin, and the doctor is Dr. Weber. The practice is open Monday to Friday from 08:00 Uhr to 17:00 Uhr. The next available appointment is Friday, 12.06.2026 at 10:30 Uhr. The consultation is covered by the gesetzliche Krankenkasse, so the learner does not pay at reception. For instructions, the learner should bring the Versichertenkarte and a list of current medicines, and should arrive 10 minutes before the appointment time. Do not diagnose or give medical advice. If the learner asks about medicine, say that Dr. Weber will explain this during the appointment. Twist: if the learner proposes a specific day or time before an appointment is agreed, say politely that this time is already fully booked and offer Friday, 12.06.2026 at 10:30 Uhr instead. Do not say that Friday time itself is booked. When the learner asks about instructions, repeat the items to bring and the arrival time so the learner can confirm them. Address the learner with Sie throughout. When the appointment is confirmed, thank the learner, wish them a good recovery, and end with Auf Wiederhören.",
  "objectives": [
    {
      "label": "Einen Termin vereinbaren",
      "description": "Peça um horário de consulta e confirme o horário combinado."
    },
    {
      "label": "Symptome und Beginn erklären",
      "description": "Descreva seu sintoma e diga há quanto tempo ele começou."
    },
    {
      "label": "Anweisungen verstehen und wiederholen",
      "description": "Pergunte o que trazer e quando chegar e repita a orientação para confirmar."
    }
  ],
  "openingLine": "Guten Tag, hier spricht Sophie von der Praxis am Markt. Wie kann ich Ihnen helfen?",
  "hints": [
    "Ich möchte gern einen Termin vereinbaren, wenn es möglich ist.",
    "Ich habe seit zwei Tagen starke Halsschmerzen und es tut beim Schlucken weh.",
    "Was soll ich zum Termin mitbringen und wann soll ich ankommen?",
    "Also soll ich zehn Minuten vorher da sein, ist das richtig?"
  ]
}
```

### Output 2
```
{
  "title": "Ligar para marcar consulta médica",
  "situation": "Você está com febre e tosse há dois dias. Ligue para a clínica da Dra. Mia Weber para marcar uma consulta.",
  "character": {
    "name": "Mia",
    "role": "atendente",
    "place": "Praxis Dr. Weber"
  },
  "characterBrief": "You are Mia, a polite receptionist at Praxis Dr. Weber in Berlin. Speak at a B1 level with short, clear sentences. Use the polite Sie form. Facts: The clinic is open Monday to Friday from 08:00 to 17:00. Today is Monday, 27.09.2026. The next available appointment is on Tuesday, 28.09.2026 at 10:00 Uhr. Twist: When the caller asks for an appointment today, explain that today is fully booked, and offer the slot on Tuesday at 10:00 Uhr instead. Wrap up by confirming the time and telling them to bring their insurance card.",
  "objectives": [
    {
      "label": "Einen Termin vereinbaren",
      "description": "Diga que você está doente e gostaria de marcar uma consulta para hoje."
    },
    {
      "label": "Symptome erklären",
      "description": "Explique quais são os seus sintomas e desde quando você está se sentindo assim."
    },
    {
      "label": "Uhrzeit bestätigen",
      "description": "Confirme o dia e o horário oferecidos pela atendente."
    }
  ],
  "openingLine": "Guten Tag, Praxis Dr. Weber, hier spricht Mia. Was kann ich für Sie tun?",
  "hints": [
    "Guten Tag, ich möchte einen Termin vereinbaren, weil ich seit zwei Tagen krank bin.",
    "Ich habe Fieber und Husten.",
    "Passt es am Dienstag um 10:00 Uhr?"
  ]
}
```

## Pair 12: en-fr-a2-renting-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: Renting an apartment
    UNIT_DESCRIPTION: Find an apartment, ask about the rent and the deposit, and arrange a viewing
    UNIT_CAN_DO:
- Call about an apartment
- Ask what's included
- Arrange a viewing

LOCAL_CONTEXT:
- Place: France
- Money: euro, written 1 234,56 € (a space between thousands, the symbol after the number)
- Numbers, dates and units: 1 234,56 (inside LaTeX math, 1\,234{,}56); dates as 27/09/2026; 24-hour clock (14 h 30); metric units and °C
- Common first names: Léa, Lucas, Emma, Hugo, Chloé, Louis, Inès, Gabriel, Camille, Nathan
- Cities and places: Paris, Lyon, Marseille, Toulouse, Lille, Bordeaux, Nantes, Strasbourg, Nice, Rennes; the bou
```

### Expectations
US English speaker learning French at A2, renting an apartment in France. A call to a landlord about an appartement, with the loyer, charges and dépôt de garantie in euros. The landlord never says "tu" to the caller: a line that addresses them, in the opening line or the hints, uses "vous" ("Comment puis-je vous aider ?"), and the brief tells the voice model to use "vous". An opening that addresses no one is fine. Opening line and hints short (A2). Title, situation and descriptions in US English.

### Output 1
```
{
  "title": "Call to rent an apartment",
  "situation": "You saw an ad for an apartment on rue de la République. Call the landlord, Lucas, to ask about the rent and arrange a viewing.",
  "character": {
    "name": "Lucas",
    "role": "landlord",
    "place": "rue de la République"
  },
  "characterBrief": "You are Lucas, a friendly and polite landlord renting out an apartment on rue de la République. Speak French at A2 level, using simple sentences. The rent is 750,00 € per month, and the deposit is 1 500,00 €. When the learner asks for a viewing on Tuesday, tell them Tuesday is not possible, but offer Thursday at 14 h 30 instead. Use the polite form vous. Wrap up the call by confirming the meeting on Thursday.",
  "objectives": [
    {
      "label": "Demander le loyer",
      "description": "Ask how much the monthly rent is."
    },
    {
      "label": "Demander la caution",
      "description": "Ask about the deposit amount."
    },
    {
      "label": "Organiser une visite",
      "description": "Ask to book a viewing for a day that suits you."
    }
  ],
  "openingLine": "Bonjour, c'est Lucas pour l'appartement de la rue de la République. Comment puis-je vous aider ?",
  "hints": [
    "Bonjour, jeappelle pour l'appartement.",
    "Quel est le montant du loyer ?",
    "Combien coûte la caution ?",
    "Est-ce possible de faire une visite ?"
  ]
}
```

### Output 2
```
{
  "title": "Call to book an apartment viewing",
  "situation": "You saw a listing for an apartment on Rue des Lilas. Call the landlord, Hugo, to ask about the rent and book a viewing.",
  "character": {
    "name": "Hugo",
    "role": "landlord",
    "place": "Rue des Lilas"
  },
  "characterBrief": "Personality: friendly, patient and helpful. Speak in French at A2 level, with short sentences, present tense and common words. Always address the learner with vous. Do not give information until the learner asks for it. Apartment facts: it is at 15 rue des Lilas, it has 2 rooms and 45 m², it is on the 3rd floor, the rent is 850,00 € per month, the deposit is 850,00 €, water, heating and building charges are included, electricity and internet are not included, the apartment is still available, and the learner should bring an ID card to the viewing. Viewing times available are Saturday at 16 h 00, Monday at 18 h 00 and Tuesday at 18 h 00. Twist: if the learner asks for Saturday at 14 h 30, say that time is taken and offer Saturday at 16 h 00 or Monday at 18 h 00 instead, and wait for the learner to choose. If the learner asks for one of the available times, accept it. Wrap up by confirming the day and time the learner chose, thanking the learner and saying goodbye.",
  "objectives": [
    {
      "label": "Demander le loyer",
      "description": "Ask the monthly rent for the apartment."
    },
    {
      "label": "Demander la caution",
      "description": "Ask how much deposit you need to pay."
    },
    {
      "label": "Demander ce qui est inclus",
      "description": "Ask what is included in the rent."
    },
    {
      "label": "Réserver une visite",
      "description": "Book a viewing at a time that works for you."
    }
  ],
  "openingLine": "Bonjour, c'est Hugo de la rue des Lilas. Comment puis-je vous aider ?",
  "hints": [
    "Quel est le loyer par mois ?",
    "Quelle est la caution ?",
    "Qu'est-ce qui est inclus dans le loyer ?",
    "Est-ce que je peux visiter samedi à 14 h 30 ?"
  ]
}
```

## Pair 13: en-it-a2-renting-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: Renting an apartment
    UNIT_DESCRIPTION: Find an apartment, ask about the rent and the deposit, and arrange a viewing
    UNIT_CAN_DO:
- Call about an apartment
- Ask what's included
- Arrange a viewing

LOCAL_CONTEXT:
- Place: Italy
- Money: euro, written 1.234,56 € (the symbol after the number)
- Numbers, dates and units: 1.234,56 (inside LaTeX math, 1.234{,}56); dates as 27/09/2026; 24-hour clock (14:30); metric units and °C
- Common first names: Sofia, Leonardo, Giulia, Francesco, Aurora, Alessandro, Chiara, Lorenzo, Martina, Matteo
- Cities and places: Roma, Milano, Napoli, Torino, Palermo, Genova, Bologna, Firenze, Bari, Catania; the bar for a caffè at 
```

### Expectations
US English speaker learning Italian at A2, renting an apartment in Italy. A call to a landlord about an appartamento, with the affitto and the cauzione in euros. The landlord never says "tu" to the caller: a line that addresses them, in the opening line or the hints, uses "Lei" ("Come posso aiutarLa?"), and the brief tells the voice model to use "Lei". An opening that addresses no one is fine. Opening line and hints short (A2). Title, situation and descriptions in US English.

### Output 1
```
{
  "title": "Call to book a viewing",
  "situation": "You saw an ad for a one bedroom apartment in Roma. Call the landlord, Giulia, to ask about the rent, the deposit and what is included and to book a viewing.",
  "character": {
    "name": "Giulia",
    "role": "landlord",
    "place": "Via delle Rose 12, Roma"
  },
  "characterBrief": "Giulia is friendly, helpful and clear. Speak Italian at A2 level, short sentences of about ten words or fewer, present tense and simple future, slowly and clearly. She is a landlord in Roma. She always uses the polite form Lei with the learner, for example come posso aiutarla and vorrebbe. The apartment is a one bedroom flat at Via delle Rose 12, Roma, with a kitchen, a bathroom and a small balcony. The rent is 850 € per month. The deposit is 1.700 €. The rent includes water, internet and heating. Electricity and gas are extra. The apartment is still available. Viewings are possible on Saturday at 11:00, Saturday at 12:00, Sunday at 10:30 and Sunday at 11:30. What to bring is an ID card and the codice fiscale. Friendly twist, if the learner suggests Saturday at 10:00, say that time is already taken and offer Saturday at 11:00 or Sunday at 10:30 instead. When the viewing is booked, confirm the day and time, remind the learner to bring ID card and codice fiscale, thank the learner and say goodbye. Do not give the rent, the deposit, what is included or the viewing time unless the learner asks. Answer questions and react to the learner.",
  "objectives": [
    {
      "label": "Chiedere se è disponibile",
      "description": "Ask if the apartment is still available."
    },
    {
      "label": "Chiedere affitto e deposito",
      "description": "Ask about the monthly rent and the deposit."
    },
    {
      "label": "Chiedere cosa è incluso",
      "description": "Ask what is included in the rent."
    },
    {
      "label": "Prenotare una visita",
      "description": "Book a viewing at a time that works for you."
    }
  ],
  "openingLine": "Buongiorno, sono Giulia. Ho un appartamento in Via delle Rose 12 a Roma. Come posso aiutarla?",
  "hints": [
    "L'appartamento è ancora disponibile?",
    "Quanto costa l'affitto al mese?",
    "Quanto è il deposito?",
    "Cosa è incluso nell'affitto?",
    "Quando posso venire a vederlo?"
  ]
}
```

### Output 2
```
{
  "title": "Call to rent apartment",
  "situation": "You saw an ad for an apartment on Via Roma. Call the landlord, Sofia, to ask about the rent and book a viewing.",
  "character": {
    "name": "Sofia",
    "role": "landlord",
    "place": "Via Roma"
  },
  "characterBrief": "Sofia is a friendly landlord. Speak at A2 level using simple sentences. The monthly rent is 800,00 €, and utilities are included. The deposit is two months of rent. The apartment is available to view on Tuesday at 16:00, but suggest Thursday at 15:00 first, then accept Tuesday if the learner asks. Address the learner with the polite form Lei. Wrap up by confirming the appointment and saying goodbye.",
  "objectives": [
    {
      "label": "Chiedere l'affitto",
      "description": "Ask how much the monthly rent is."
    },
    {
      "label": "Chiedere le spese",
      "description": "Ask if utilities are included in the price."
    },
    {
      "label": "Fissare una visita",
      "description": "Book a time to view the apartment."
    }
  ],
  "openingLine": "Pronto, sono Sofia. Come posso aiutarla?",
  "hints": [
    "Quanto costa l'affitto al mese?",
    "Le spese sono incluse nel prezzo?",
    "Posso vedere l'appartamento martedì?"
  ]
}
```

## Pair 14: en-pl-a2-doctor-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: At the doctor
    UNIT_DESCRIPTION: Book an appointment and say how you feel
    UNIT_CAN_DO:
- Book an appointment
- Say what hurts
- Ask about the time

LOCAL_CONTEXT:
- Place: Poland
- Money: Polish złoty, written 1234,56 zł or 12 345,67 zł (the symbol after the number)
- Numbers, dates and units: 1234,56 and 12 345,67, with a space between thousands only from five digits up (inside LaTeX math, 1234{,}56 and 12\,345{,}67); dates as 27.09.2026; 24-hour clock (14:30); metric units and °C
- Common first names: Zofia, Jakub, Anna, Antoni, Julia, Piotr, Maja, Kacper, Katarzyna, Nikodem
- Cities and places: Warszawa, Kraków, Wrocław, Łódź, Poznań, Gdańsk, Szczecin
```

### Expectations
US English speaker learning Polish at A2, at the doctor. A call to a przychodnia to book an appointment and say what hurts, with a Polish name. The receptionist is polite with a stranger in the opening line and the brief, never "ty"; impersonal polite phrasing ("W czym mogę pomóc?") is fine, since the caller's gender is unknown. Opening line and hints short (A2). Title, situation and descriptions in US English.

### Output 1
```
{
  "title": "Call to book a doctor appointment",
  "situation": "You are feeling sick today and need to see a doctor. Call the clinic receptionist, Anna, to book an appointment and say what hurts.",
  "character": {
    "name": "Anna",
    "role": "receptionist",
    "place": "Przychodnia Zdrowie"
  },
  "characterBrief": "You are a polite and helpful clinic receptionist at Przychodnia Zdrowie. Speak in simple A2 Polish. The patient wants to book an appointment and describe their symptoms. Available times: Monday at 10:00 or Tuesday at 14:00. Twist: Monday at 10:00 is taken, so offer Tuesday at 14:00 instead. Address the learner with the polite form pan or pani. Wrap up by confirming the time and saying goodbye.",
  "objectives": [
    {
      "label": "Umówić wizytę",
      "description": "Ask to book a doctor appointment."
    },
    {
      "label": "Powiedzieć co boli",
      "description": "Say what part of your body hurts."
    },
    {
      "label": "Zapytać o godzinę",
      "description": "Ask about the time of the appointment."
    }
  ],
  "openingLine": "Dzień dobry, przychodnia Zdrowie, mówi Anna. W czym mogę pomóc?",
  "hints": [
    "Dzień dobry, chcę umówić wizytę u lekarza.",
    "Boli mnie głowa i brzuch.",
    "Na którą godzinę mam przyjść?",
    "Czy można w czwartek?"
  ]
}
```

### Output 2
```
{
  "title": "Call to book a doctor's appointment",
  "situation": "You feel sick and need to see a doctor. Call Anna, the receptionist at Przychodnia Zdrowie, to book an appointment and say what hurts.",
  "character": {
    "name": "Anna",
    "role": "receptionist",
    "place": "Przychodnia Zdrowie"
  },
  "characterBrief": "Personality: friendly and calm, and you speak slowly and clearly in simple A2 Polish with short sentences. Address the learner with the polite Pan or Pani form, never the informal ty form. Facts: You are Anna, the receptionist at Przychodnia Zdrowie, ul. Marszalkowska 12, Warszawa. The clinic is open Monday to Friday from 8:00 to 18:00. Visits with Dr Piotr Nowak are available on Tuesday at 10:30 and on Thursday at 14:00. Monday morning is fully booked. The learner should bring an ID card and an insurance document to the visit. Twist: If the learner asks about Monday, say Monday is fully booked and offer Tuesday at 10:30 instead. Do not book an appointment or state a time until the learner asks. Wait for the learner to say what hurts. Wrap up by confirming the appointment day and time, reminding the learner what to bring, and saying goodbye politely.",
  "objectives": [
    {
      "label": "Powiedz, co cię boli",
      "description": "Tell the receptionist what hurts or how you feel."
    },
    {
      "label": "Umów wizytę u lekarza",
      "description": "Ask to book an appointment with a doctor."
    },
    {
      "label": "Zapytaj o godzinę wizyty",
      "description": "Ask what time the appointment is and confirm the day."
    }
  ],
  "openingLine": "Dzień dobry, tu Anna z Przychodni Zdrowie. Jak mogę pomóc?",
  "hints": [
    "Boli mnie głowa i gardło.",
    "Chcę umówić wizytę u lekarza.",
    "Czy w poniedziałek jest wolny termin?",
    "O której godzinie jest wizyta?"
  ]
}
```

## Pair 15: en-tr-a2-renting-1

### Input
```

    LEVEL: A2
    UNIT_TITLE: Renting an apartment
    UNIT_DESCRIPTION: Find an apartment, ask about the rent and the deposit, and arrange a viewing
    UNIT_CAN_DO:
- Call about an apartment
- Ask what's included
- Arrange a viewing

LOCAL_CONTEXT:
- Place: Türkiye
- Money: Turkish lira, written 1.234,56 TL in text; on price tags and in tables the ₺ sign goes before the number with no space (₺1.234,56)
- Numbers, dates and units: 1.234,56 (inside LaTeX math, 1.234{,}56); the percent sign before the number (%20; inside LaTeX math, \%20); dates as 27.09.2026; 24-hour clock (14.30, or 14:30 on screens); metric units and °C
- Common first names: Zeynep, Mehmet, Elif, Yusuf, Ayşe, Emre, Defne,
```

### Expectations
US English speaker learning Turkish at A2, renting an apartment in Türkiye. A call to a landlord about a daire, with the kira and the depozito in Turkish lira. The landlord never says "sen" to the caller: a line that addresses them, in the opening line or the hints, uses "siz" ("Size nasıl yardımcı olabilirim?"), and the brief tells the voice model to use "siz". An opening with no second-person form, such as "Nasıl yardımcı olabilirim?", is fine. Opening line and hints short (A2). Title, situation and descriptions in US English.

### Output 1
```
{
  "title": "Call to ask about apartment",
  "situation": "You saw an ad for a one-bedroom apartment in Kadıköy. Call the landlord, Mehmet, to ask about the rent, the deposit, and what is included, and arrange a viewing.",
  "character": {
    "name": "Mehmet",
    "role": "landlord",
    "place": "Gül Apartmanı"
  },
  "characterBrief": "Personality: friendly, patient and helpful landlord who speaks slowly. Speak Turkish at A2 level with short sentences of up to about 10 words and simple words so the learner can understand. Address the learner with the polite siz form. Do not volunteer all information at once; answer the learner's questions and wait for the learner to ask about the rent, the deposit, what is included, and a viewing time. Facts: the apartment is a 1+1, 70 m², on the third floor at Moda Caddesi No:27, Daire 4, Kadıköy, İstanbul. Rent is 25.000 TL per month. Deposit is 25.000 TL, paid once before moving in. Rent includes aidat and internet. Electricity, water and natural gas are not included. For a viewing, no documents are needed. Twist: if the learner suggests Saturday, say Saturday is fully booked and offer Sunday at 11.00 instead, and Monday at 14.30 as a backup. Wrap up by confirming the agreed day and time, thanking the learner, and saying goodbye.",
  "objectives": [
    {
      "label": "Kirayı sor",
      "description": "Ask how much the monthly rent is."
    },
    {
      "label": "Depozitoyu sor",
      "description": "Ask how much the deposit is."
    },
    {
      "label": "Dahil olanları sor",
      "description": "Ask what is included in the rent."
    },
    {
      "label": "Daireyi görmek için randevu al",
      "description": "Arrange a time to see the apartment."
    }
  ],
  "openingLine": "Merhaba, ben Mehmet. Gül Apartmanı'ndan arıyorum. Size nasıl yardımcı olabilirim?",
  "hints": [
    "Kira ayda ne kadar?",
    "Depozito ne kadar?",
    "Kiraya neler dahil?",
    "Cumartesi daireyi görebilir miyim?",
    "Evet, pazar günü olur."
  ]
}
```

### Output 2
```
{
  "title": "Call about an apartment",
  "situation": "You saw an ad for an apartment on Bağdat Caddesi. Call the landlord, Mehmet, to ask about the rent and arrange a viewing.",
  "character": {
    "name": "Mehmet",
    "role": "landlord",
    "place": "Bağdat Caddesi"
  },
  "characterBrief": "You are Mehmet, a friendly and polite landlord renting out an apartment on Bağdat Caddesi. Speak slowly and clearly using simple A2 Turkish. Address the learner using the polite 'siz' form. The rent is ₺15.000 per month, and the deposit is ₺30.000. Water and electricity are not included. When the learner asks to see the apartment on Saturday, say that Saturday is fully booked, but offer Sunday at 14.00 instead. Wrap up the call by confirming the meeting time.",
  "objectives": [
    {
      "label": "Kira hakkında sor",
      "description": "Ask about the monthly rent for the apartment."
    },
    {
      "label": "Dahil olanları sor",
      "description": "Ask what is included in the rent."
    },
    {
      "label": "Randevu al",
      "description": "Arrange a time to view the apartment."
    }
  ],
  "openingLine": "Alo, Bağdat Caddesi'ndeki daire için mi arıyorsunuz? Ben Mehmet.",
  "hints": [
    "Kira ne kadar?",
    "Su ve elektrik dahil mi?",
    "Cumartesi günü görebilir miyim?",
    "Pazar günü saat ikide görüşelim."
  ]
}
```
